import { supabase } from "@/integrations/supabase/client";
import type { AiMsg } from "@/lib/ai-prompts";

export const COACH_TIMEOUT_MESSAGE =
  "Voice processing is taking longer than expected. Please try again.";
// Slightly above the server limits so the server normally reports first.
const FIRST_CHUNK_MS = 22_000;
const BETWEEN_CHUNKS_MS = 17_000;

async function postCoachStream(messages: AiMsg[], token: string, signal: AbortSignal) {
  return fetch("/api/coach-stream", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
    signal,
  });
}

/**
 * Streams Gemini text to the UI and retries once if the access token expired.
 * The request is really aborted when `signal` fires (screen left) or when no
 * chunk arrives within the time limits, so it never stays "Preparing…".
 */
export async function streamCoachReply(
  messages: AiMsg[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };
  const onExternalAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    let session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error("Please sign in again to use voice conversation.");

    arm(FIRST_CHUNK_MS);
    let response = await postCoachStream(messages, session.access_token, controller.signal);
    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
      if (!session || refreshed.error)
        throw new Error("Please sign in again to use voice conversation.");
      arm(FIRST_CHUNK_MS);
      response = await postCoachStream(messages, session.access_token, controller.signal);
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
      arm(BETWEEN_CHUNKS_MS);
      buffer += value;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      events.forEach(consume);
    }
    if (buffer.trim()) consume(buffer);
    if (streamError) throw new Error(streamError);
    if (!text.trim()) throw new Error("AI Talking returned an empty reply.");
    return text.trim();
  } catch (error) {
    if (timedOut) throw new Error(COACH_TIMEOUT_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
