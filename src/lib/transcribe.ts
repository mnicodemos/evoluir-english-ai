import { supabase } from "@/integrations/supabase/client";

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
        const payload = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string; text?: string };
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

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\s]/g, "").trim();

/** Rough similarity (0-1) between what the student said and the target word. */
export function pronunciationScore(target: string, spoken: string): number {
  const a = normalize(target);
  const b = normalize(spoken);
  if (!a || !b) return 0;
  if (b === a || b.split(/\s+/).includes(a)) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...Array<number>(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j += 1) dist[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i]![j] = Math.min(dist[i - 1]![j]! + 1, dist[i]![j - 1]! + 1, dist[i - 1]![j - 1]! + cost);
    }
  }
  return Math.max(0, 1 - dist[rows - 1]![cols - 1]! / Math.max(a.length, b.length));
}
