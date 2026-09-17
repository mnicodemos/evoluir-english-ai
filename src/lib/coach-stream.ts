import { supabase } from "@/integrations/supabase/client";
import type { AiMsg } from "@/lib/ai-prompts";

async function postCoachStream(messages: AiMsg[], token: string) {
  return fetch("/api/coach-stream", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });
}

/** Streams Gemini text to the UI and retries once if the access token expired. */
export async function streamCoachReply(
  messages: AiMsg[],
  onDelta: (delta: string) => void,
): Promise<string> {
  let session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error("Please sign in again to use voice conversation.");

  let response = await postCoachStream(messages, session.access_token);
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
    if (!session || refreshed.error)
      throw new Error("Please sign in again to use voice conversation.");
    response = await postCoachStream(messages, session.access_token);
  }

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `AI Talking failed (${response.status}).`);
  }

  let buffer = "";
  let text = "";
  let streamError = "";
  const consume = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          delta?: string;
          message?: string;
        };
        if (payload.type === "coach.text.delta" && payload.delta) {
          text += payload.delta;
          onDelta(payload.delta);
        }
        if (payload.type === "coach.text.error")
          streamError = payload.message ?? "AI Talking could not answer.";
      } catch {
        // Ignore provider keep-alives and metadata-only events.
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
  if (streamError) throw new Error(streamError);
  if (!text.trim()) throw new Error("AI Talking returned an empty reply.");
  return text.trim();
}
