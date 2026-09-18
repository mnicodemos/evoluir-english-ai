import { supabase } from "@/integrations/supabase/client";

const BROWSER_VOICE_PROFILE = {
  pitch: 1,
  rate: 0.95,
  preferredNames: ["samantha", "victoria", "zira", "female"],
};

const SPEECH_CACHE_NAME = "evoluir-static-speech-v1";
const SPEECH_FORMAT_VERSION = "pcm24-kore-095-v1";

export type SpeechOptions = {
  cache?: "memory" | "persistent";
  /**
   * Playback speed applied to the generated audio (1 = natural speed).
   * Used to slow the voice down for lower CEFR levels without changing the
   * audio provider or the cached audio itself.
   */
  rate?: number;
};

let audioContext: AudioContext | null = null;
const activeSources = new Set<AudioBufferSourceNode>();
let activeUtterance: SpeechSynthesisUtterance | null = null;
let playRequest = 0;
let aiSpeechUnavailableUntil = 0;

const audioCache = new Map<string, Float32Array>();
const pendingAudio = new Map<string, Promise<Float32Array>>();

function pcmBytesToSamples(pcm: Uint8Array): Float32Array {
  const sampleCount = Math.floor(pcm.byteLength / 2);
  const view = new DataView(pcm.buffer, pcm.byteOffset, sampleCount * 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}

async function speechCacheRequest(value: string) {
  const input = new TextEncoder().encode(
    `${SPEECH_FORMAT_VERSION}:${value.trim().toLocaleLowerCase("en-US")}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return new Request(`${window.location.origin}/__speech-cache__/${hash}`);
}

async function readPersistentSpeech(value: string): Promise<Float32Array | null> {
  if (!("caches" in window) || !crypto.subtle) return null;
  try {
    const cache = await caches.open(SPEECH_CACHE_NAME);
    const response = await cache.match(await speechCacheRequest(value));
    return response ? pcmBytesToSamples(new Uint8Array(await response.arrayBuffer())) : null;
  } catch {
    return null;
  }
}

async function writePersistentSpeech(value: string, chunks: Uint8Array[]) {
  if (!("caches" in window) || !crypto.subtle) return;
  try {
    const blob = new Blob(
      chunks.map((chunk) => chunk.slice()),
      { type: "audio/L16;rate=24000;channels=1" },
    );
    const cache = await caches.open(SPEECH_CACHE_NAME);
    await cache.put(
      await speechCacheRequest(value),
      new Response(blob, {
        headers: {
          "Content-Type": blob.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      }),
    );
  } catch {
    // Private browsing and storage quotas can disable Cache API writes.
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function stopCurrentAudio() {
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // A source that already finished cannot be stopped again.
    }
  }
  activeSources.clear();
}

/** Interrupts anything currently being spoken so the user can talk instead. */
export function stopSpeaking() {
  playRequest += 1;
  stopCurrentAudio();
  activeUtterance = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function mergePcmChunks(chunks: Uint8Array[]): Float32Array {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (byteLength < 2) throw new Error("The audio service returned no playable sound.");

  const pcm = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }

  return pcmBytesToSamples(pcm);
}

async function requestSpeech(
  value: string,
  onChunk?: (chunk: Uint8Array) => void,
  cacheMode: SpeechOptions["cache"] = "memory",
): Promise<Float32Array> {
  const cacheKey = value.toLocaleLowerCase("en-US");
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  if (cacheMode === "persistent") {
    const persisted = await readPersistentSpeech(value);
    if (persisted) {
      audioCache.set(cacheKey, persisted);
      return persisted;
    }
  }

  if (Date.now() < aiSpeechUnavailableUntil) {
    throw new Error("AI audio is temporarily busy.");
  }

  const existing = pendingAudio.get(cacheKey);
  if (existing) return existing;

  const request = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in again to use audio.");

    const response = await fetch("/api/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: value, cacheable: cacheMode === "persistent" }),
    });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
        aiSpeechUnavailableUntil = Date.now() + delayMs;
      }
      throw new Error(body?.message ?? `Audio failed (${response.status}).`);
    }

    let buffer = "";
    const chunks: Uint8Array[] = [];
    let streamError = "";
    const consumeEvent = (event: string) => {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        try {
          const payload = JSON.parse(line.slice(5).trim()) as {
            type?: string;
            audio?: string;
            message?: string;
          };
          if (payload.type === "speech.audio.delta" && payload.audio) {
            const decoded = decodeBase64(payload.audio);
            chunks.push(decoded);
            onChunk?.(decoded);
          }
          if (payload.type === "speech.audio.error")
            streamError = payload.message ?? "Audio generation failed.";
        } catch {
          // Ignore keep-alives and non-audio events.
        }
      }
    };

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      buffer += chunk;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      events.forEach(consumeEvent);
    }
    if (buffer.trim()) consumeEvent(buffer);
    if (streamError) throw new Error(streamError);

    const samples = mergePcmChunks(chunks);
    audioCache.set(cacheKey, samples);
    if (cacheMode === "persistent") await writePersistentSpeech(value, chunks);
    return samples;
  })();

  pendingAudio.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingAudio.delete(cacheKey);
  }
}

/** Keeps the playback speed inside a natural, intelligible range. */
function clampRate(rate: number | undefined) {
  if (!rate || !Number.isFinite(rate)) return 1;
  return Math.min(1.2, Math.max(0.6, rate));
}

/** Free browser voice used whenever the audio service is unavailable. */
async function speakWithBrowser(value: string, rate = 1): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) throw new Error("Audio playback is not supported by this browser.");

  synth.cancel();
  synth.resume();
  let voices = synth.getVoices();
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 500);
      synth.addEventListener(
        "voiceschanged",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
    voices = synth.getVoices();
  }

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(value);
    const profile = BROWSER_VOICE_PROFILE;
    activeUtterance = utterance;
    utterance.lang = "en-US";
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate * clampRate(rate);
    const englishVoices = voices.filter((candidate) =>
      candidate.lang?.toLowerCase().startsWith("en"),
    );
    if (englishVoices.length > 0) {
      const preferred = englishVoices.find((candidate) => {
        const name = candidate.name.toLowerCase();
        return profile.preferredNames.some((preferredName) => name.includes(preferredName));
      });
      utterance.voice = preferred ?? englishVoices[0] ?? null;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      activeUtterance = null;
      window.clearInterval(timer);
      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = (event) => {
      if (settled) return;
      const reason = (event as SpeechSynthesisErrorEvent).error;
      // Cancelling or interrupting is a normal stop, not a failure.
      if (!reason || reason === "interrupted" || reason === "canceled") {
        finish();
        return;
      }
      settled = true;
      activeUtterance = null;
      window.clearInterval(timer);
      reject(new Error("Could not play this pronunciation."));
    };

    // Some browsers never fire onend; resolve once the speech queue is idle.
    const timer = window.setInterval(() => {
      if (!synth.speaking && !synth.pending) finish();
    }, 400) as unknown as number;

    try {
      synth.speak(utterance);
    } catch {
      settled = true;
      activeUtterance = null;
      window.clearInterval(timer);
      reject(new Error("Could not play this pronunciation."));
    }
  });
}

/**
 * Streams clear English pronunciation from the app's authenticated audio route,
 * falling back to the built-in browser voice when the service is unavailable.
 */
export async function speakEnglish(text: string, options: SpeechOptions = {}): Promise<void> {
  const value = text?.trim();
  if (!value || typeof window === "undefined") throw new Error("Choose a word to hear.");

  const rate = clampRate(options.rate);
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return speakWithBrowser(value, rate);
  audioContext ??= new AudioContextClass({ sampleRate: 24000 });
  if (audioContext.state === "suspended") await audioContext.resume();
  const context = audioContext;
  const requestId = ++playRequest;
  stopCurrentAudio();

  let samples: Float32Array;
  let streamed = false;
  let playhead = context.currentTime + 0.05;
  let pendingByte: number | null = null;

  const scheduleChunk = (incoming: Uint8Array) => {
    if (requestId !== playRequest) return;
    let bytes = incoming;
    if (pendingByte !== null) {
      const joined = new Uint8Array(incoming.length + 1);
      joined[0] = pendingByte;
      joined.set(incoming, 1);
      bytes = joined;
      pendingByte = null;
    }
    if (bytes.length % 2 !== 0) {
      pendingByte = bytes[bytes.length - 1] ?? null;
      bytes = bytes.slice(0, -1);
    }
    if (bytes.length === 0) return;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const floats = new Float32Array(bytes.byteLength / 2);
    for (let index = 0; index < floats.length; index += 1) {
      floats[index] = view.getInt16(index * 2, true) / 32768;
    }
    const decoded = context.createBuffer(1, floats.length, 24000);
    decoded.copyToChannel(floats, 0);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 1.15;
    source.buffer = decoded;
    source.playbackRate.value = rate;
    source.connect(gain);
    gain.connect(context.destination);
    playhead = Math.max(playhead, context.currentTime + 0.02);
    source.onended = () => activeSources.delete(source);
    source.start(playhead);
    playhead += decoded.duration / rate;
    activeSources.add(source);
    streamed = true;
  };

  try {
    samples = await requestSpeech(value, scheduleChunk, options.cache ?? "memory");
  } catch {
    if (requestId !== playRequest) return;
    if (streamed) return;
    return speakWithBrowser(value);
  }
  if (requestId !== playRequest) return;
  if (context.state === "suspended") await context.resume();

  const scheduledSources = Array.from(activeSources);
  const finalSource = scheduledSources[scheduledSources.length - 1];
  if (streamed && finalSource) {
    await new Promise<void>((resolve) => {
      finalSource.onended = () => {
        activeSources.delete(finalSource);
        resolve();
      };
    });
    return;
  }

  const decoded = context.createBuffer(1, samples.length, 24000);
  decoded.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = 1.15;
  source.buffer = decoded;
  source.connect(gain);
  gain.connect(context.destination);
  activeSources.add(source);

  await new Promise<void>((resolve, reject) => {
    source.onended = () => {
      activeSources.delete(source);
      resolve();
    };
    try {
      source.start();
    } catch {
      activeSources.delete(source);
      reject(new Error("Audio could not start on this device. Please tap again."));
    }
  });
}
