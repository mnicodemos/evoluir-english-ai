import { supabase } from "@/integrations/supabase/client";

/** Voices available on the AI speech service. The user picks one; it persists per device. */
export const VOICE_OPTIONS = [
  { id: "alloy", label: "Alloy · neutral" },
  { id: "ash", label: "Ash · calm male" },
  { id: "coral", label: "Coral · warm female" },
  { id: "echo", label: "Echo · deep male" },
  { id: "fable", label: "Fable · storyteller" },
  { id: "nova", label: "Nova · friendly female" },
  { id: "onyx", label: "Onyx · strong male" },
  { id: "sage", label: "Sage · relaxed female" },
  { id: "shimmer", label: "Shimmer · bright female" },
] as const;

export type SpeechVoice = (typeof VOICE_OPTIONS)[number]["id"];
const VOICE_STORAGE_KEY = "ai-speech-voice-v1";

export function getSpeechVoice(): SpeechVoice {
  try {
    const stored = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (VOICE_OPTIONS.some((option) => option.id === stored)) return stored as SpeechVoice;
  } catch {
    // Storage unavailable — fall through to the default voice.
  }
  return "alloy";
}

export function setSpeechVoice(voice: SpeechVoice) {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, voice);
  } catch {
    // Storage unavailable — the choice only lasts for this session.
  }
}

let audioContext: AudioContext | null = null;
const activeSources = new Set<AudioBufferSourceNode>();
let playRequest = 0;

const audioCache = new Map<string, Float32Array>();
const pendingAudio = new Map<string, Promise<Float32Array>>();

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

  const sampleCount = Math.floor(pcm.byteLength / 2);
  const view = new DataView(pcm.buffer, pcm.byteOffset, sampleCount * 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}

async function requestSpeech(
  value: string,
  onChunk?: (chunk: Uint8Array) => void,
): Promise<Float32Array> {
  const voice = getSpeechVoice();
  const cacheKey = `${voice}:${value.toLocaleLowerCase("en-US")}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

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
      body: JSON.stringify({ text: value, voice }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
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
          if (payload.type === "speech.audio.error") streamError = payload.message ?? "Audio generation failed.";
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
    return samples;
  })();

  pendingAudio.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingAudio.delete(cacheKey);
  }
}

/** Waits for the browser voice list, which loads asynchronously on most browsers. */
function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", done, { once: true });
    window.setTimeout(done, 1200);
  });
}

/** Free browser voice used whenever the audio service is unavailable. */
async function speakWithBrowser(value: string): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) throw new Error("Audio playback is not supported by this browser.");

  synth.cancel();
  const voices = await loadVoices(synth);

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    const english = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
    if (english) utterance.voice = english;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
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
      window.clearInterval(timer);
      reject(new Error("Could not play this pronunciation."));
    }
  });
}

/**
 * Streams clear English pronunciation from the app's authenticated audio route,
 * falling back to the built-in browser voice when the service is unavailable.
 */
export async function speakEnglish(text: string): Promise<void> {
  const value = text?.trim();
  if (!value || typeof window === "undefined") throw new Error("Choose a word to hear.");

  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return speakWithBrowser(value);
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
    source.connect(gain);
    gain.connect(context.destination);
    playhead = Math.max(playhead, context.currentTime + 0.02);
    source.onended = () => activeSources.delete(source);
    source.start(playhead);
    playhead += decoded.duration;
    activeSources.add(source);
    streamed = true;
  };

  try {
    samples = await requestSpeech(value, scheduleChunk);
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
