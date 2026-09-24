// AI Talking text generation on the standard Lovable AI service.
// Receives exactly the same system/user/assistant messages the Gemini path used.
export const LOVABLE_TALKING_MODEL = "openai/gpt-6-astra";
const RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export class LovableChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function body(messages: Msg[]) {
  const instructions = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    }));
  return JSON.stringify({
    model: LOVABLE_TALKING_MODEL,
    ...(instructions ? { instructions } : {}),
    input,
    stream: true,
    store: false,
    reasoning: { effort: "low" },
  });
}

/** Opens the upstream SSE stream. Returns null when the key is missing. */
export async function openLovableTalkingStream(
  messages: Msg[],
  signal?: AbortSignal,
): Promise<Response | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  return fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: body(messages),
    ...(signal ? { signal } : {}),
  });
}

export type LovableUsage = { inputTokens?: number; outputTokens?: number };

/** Parses one SSE event block. */
export function parseLovableEvent(event: string): {
  delta: string;
  error?: string;
  usage?: LovableUsage;
} {
  let delta = "";
  let error: string | undefined;
  let usage: LovableUsage | undefined;
  for (const line of event.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;
    try {
      const p = JSON.parse(raw) as {
        type?: string;
        delta?: string;
        message?: string;
        error?: { message?: string };
        response?: {
          error?: { message?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
        };
      };
      if (p.type === "response.output_text.delta" && typeof p.delta === "string") delta += p.delta;
      else if (p.type === "error" || p.type === "response.failed")
        error = p.message ?? p.error?.message ?? p.response?.error?.message ?? "AI reply failed";
      else if (p.type === "response.completed" && p.response?.usage) {
        const u = p.response.usage;
        usage = {
          ...(typeof u.input_tokens === "number" ? { inputTokens: u.input_tokens } : {}),
          ...(typeof u.output_tokens === "number" ? { outputTokens: u.output_tokens } : {}),
        };
      }
    } catch {
      // keep-alive
    }
  }
  return { delta, ...(error ? { error } : {}), ...(usage ? { usage } : {}) };
}

/** Streams and accumulates the full reply (used for the first sentence). */
export async function callLovableTalking(
  messages: Msg[],
  onUsage?: (usage: LovableUsage) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await openLovableTalkingStream(messages, signal);
  if (!res) return null;
  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    console.error(`Lovable AI talking failed [${res.status}]: ${raw.slice(0, 300)}`);
    throw new LovableChatError(
      res.status,
      "AI Talking could not answer right now. Please try again.",
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  const handle = (event: string) => {
    const parsed = parseLovableEvent(event);
    text += parsed.delta;
    if (parsed.usage) onUsage?.(parsed.usage);
    if (parsed.error) throw new LovableChatError(502, "AI Talking could not answer right now.");
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const events = pending.split(/\r?\n\r?\n/);
    pending = events.pop() ?? "";
    events.forEach(handle);
  }
  if (pending.trim()) handle(pending);
  const trimmed = text.trim();
  if (!trimmed) throw new LovableChatError(502, "AI Talking returned an empty reply.");
  return trimmed;
}
