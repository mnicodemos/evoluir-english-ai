import { supabase } from "@/integrations/supabase/client";
import { pronunciationSimilarity } from "@/lib/legacyScores";

/**
 * The longest the student waits for a check (audit, 2026-10-25): the server
 * gives up after 20 s, so past 25 s the connection itself has stalled and
 * "Checking..." would otherwise never end.
 */
export const TRANSCRIBE_CLIENT_TIMEOUT_MS = 25_000;
export const TRANSCRIBE_TIMEOUT_MESSAGE = "This is taking too long. Please try again.";

/** Sends a recorded WAV blob to the transcription endpoint and returns the recognized English text. */
export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TRANSCRIBE_CLIENT_TIMEOUT_MS);
  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", forward, { once: true });
  try {
    return await transcribeOnce(audio, controller.signal);
  } catch (error) {
    if (timedOut) throw new Error(TRANSCRIBE_TIMEOUT_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}

async function transcribeOnce(audio: Blob, signal: AbortSignal): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to use the microphone.");

  const form = new FormData();
  form.append("file", audio, "recording.wav");
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Transcription failed (${response.status}).`);
  }

  let buffer = "";
  let transcript = "";
  const consume = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          delta?: string;
          text?: string;
        };
        if (payload.type === "transcript.text.delta") transcript += payload.delta ?? "";
        if (payload.type === "transcript.text.done" && payload.text) transcript = payload.text;
      } catch {
        // Ignore keep-alive events.
      }
    }
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    events.forEach(consume);
  }
  if (buffer.trim()) consume(buffer);
  if (!transcript.trim()) throw new Error("I couldn't hear that clearly. Please try again.");
  return transcript.trim();
}

/** Rough similarity (0-1) between what the student said and the target word. */
export function pronunciationScore(target: string, spoken: string): number {
  return pronunciationSimilarity(target, spoken);
}
