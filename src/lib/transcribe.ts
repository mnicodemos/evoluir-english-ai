import { supabase } from "@/integrations/supabase/client";
import { pronunciationSimilarity } from "@/lib/legacyScores";

/** Sends a recorded WAV blob to the transcription endpoint and returns the recognized English text. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to use the microphone.");

  const form = new FormData();
  form.append("file", audio, "recording.wav");
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
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
