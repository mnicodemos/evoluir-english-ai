const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key";
// Use the lighter model for short tutoring exchanges and keep the larger
// model as a quota fallback. This avoids exhausting the smaller free quota
// assigned to the larger model during normal speaking practice.
export const GEMINI_TEXT_MODEL = "gemini-3.6-flash";
const MODELS = [GEMINI_TEXT_MODEL, "gemini-3.5-flash"];

/** Attempts per model for temporary errors; total calls are bounded (2 models x 2). */
export const GEMINI_ATTEMPTS_PER_MODEL = 2;

export function isTemporaryGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** 1.5 s, then 3 s; honours Retry-After up to 5 s. */
export function geminiBackoffMs(attempt: number, retryAfterSeconds = 0): number {
  const base = 1500 * 2 ** (attempt - 1);
  return retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, 5000) : base;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export type GeminiMessage = { role: "system" | "user" | "assistant"; content: string };

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

function requestBody(messages: GeminiMessage[], jsonMode = false) {
  const systemParts = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content);
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  return JSON.stringify({
    contents,
    ...(systemParts.length
      ? { systemInstruction: { parts: systemParts.map((text) => ({ text })) } }
      : {}),
    generationConfig: {
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
}

function connectorCredentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
  return lovableKey && connectionKey ? { lovableKey, connectionKey } : null;
}

export async function openGeminiStream(
  messages: GeminiMessage[],
  signal?: AbortSignal,
): Promise<Response | null> {
  const credentials = connectorCredentials();
  if (!credentials) return null;
  return fetch(`${GATEWAY_URL}/v1beta/models/${MODELS[0]}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.lovableKey}`,
      "X-Connection-Api-Key": credentials.connectionKey,
      "Content-Type": "application/json",
    },
    body: requestBody(messages),
    ...(signal ? { signal } : {}),
  });
}

export type GeminiUsage = { inputTokens?: number; outputTokens?: number };

/**
 * Reads the token counts Gemini already returns in `usageMetadata`. Nothing is
 * estimated: a field that the provider omits stays undefined.
 */
export function extractGeminiUsage(payload: unknown): GeminiUsage {
  const meta = (payload as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!meta) return {};
  const input = meta["promptTokenCount"];
  const output = meta["candidatesTokenCount"];
  return {
    ...(typeof input === "number" && Number.isFinite(input) ? { inputTokens: input } : {}),
    ...(typeof output === "number" && Number.isFinite(output) ? { outputTokens: output } : {}),
  };
}

/**
 * Calls Google Gemini through the connector gateway using the workspace's own
 * Gemini key. Used for the heavy content generation (lessons + quizzes).
 * Returns null when the connection is not configured, so callers can fall back
 * to the Lovable AI gateway.
 */
export async function callGemini(
  messages: GeminiMessage[],
  jsonMode = false,
  onUsage?: (usage: GeminiUsage) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const credentials = connectorCredentials();
  if (!credentials) return null;
  const body = requestBody(messages, jsonMode);

  let lastStatus = 503;
  let retryAfter = 0;
  for (const model of MODELS) {
    // Controlled retry for temporary provider errors only (429/5xx), with a fixed
    // small number of attempts and backoff. Terminal errors stop immediately.
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS_PER_MODEL; attempt++) {
      const started = Date.now();
      const res = await fetch(`${GATEWAY_URL}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.lovableKey}`,
          "X-Connection-Api-Key": credentials.connectionKey,
          "Content-Type": "application/json",
        },
        body,
        ...(signal ? { signal } : {}),
      });

      if (!res.ok) {
        lastStatus = res.status;
        retryAfter = Number(res.headers.get("Retry-After") ?? 0);
        const errorBody = await res.text();
        const temporary = isTemporaryGeminiStatus(res.status);
        console.error(
          `Gemini attempt ${attempt}/${GEMINI_ATTEMPTS_PER_MODEL} failed [${res.status}] on ${model} after ${Date.now() - started}ms (temporary=${temporary}): ${errorBody.slice(0, 300)}`,
        );
        if (!temporary) break;
        if (attempt < GEMINI_ATTEMPTS_PER_MODEL) {
          await sleep(geminiBackoffMs(attempt, retryAfter), signal);
          continue;
        }
        break; // attempts exhausted on this model: try the next model
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (text) {
        if (attempt > 1 || model !== MODELS[0])
          console.info(`Gemini succeeded on ${model}, attempt ${attempt}`);
        onUsage?.(extractGeminiUsage(data));
        return text;
      }
      lastStatus = 502;
      console.error(
        `Gemini returned an empty answer on ${model} (finishReason=${data.candidates?.[0]?.finishReason ?? "none"})`,
      );
      break;
    }
    // A terminal (non-temporary) error would fail identically on the next model.
    if (!isTemporaryGeminiStatus(lastStatus) && lastStatus !== 502) break;
  }

  throw new GeminiError(
    lastStatus,
    lastStatus === 429
      ? "Your Google Gemini limit is temporarily busy. Please try again in a moment."
      : lastStatus >= 500
        ? "The AI service is very busy right now (high demand). Please try again in a few minutes."
        : "Google Gemini could not answer right now. Please try again in a moment.",
    retryAfter,
  );
}
