type Msg = { role: "system" | "user" | "assistant"; content: string };
import type { AiOperation } from "./ai-usage.server";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * All AI usage runs on the workspace's own Google Gemini key.
 * There is no third-party fallback on purpose.
 */
export async function callGateway(
  messages: Msg[],
  jsonMode = false,
  usage?: { userId: string; operation: AiOperation },
  signal?: AbortSignal,
): Promise<string> {
  const {
    callGemini,
    GEMINI_TEXT_MODEL: geminiModel,
    GeminiError,
  } = await import("./gemini.server");
  // AI Talking conversation text (first sentence + replies) runs on the
  // standard Lovable AI service; the JSON report and every other feature keep
  // their current provider.
  const useLovable = usage?.operation === "talking" && !jsonMode;
  const lovable = useLovable ? await import("./lovable-chat.server") : null;
  const GEMINI_TEXT_MODEL = lovable ? lovable.LOVABLE_TALKING_MODEL : geminiModel;
  const usageTools = usage ? await import("./ai-usage.server") : null;
  const requestHash = usageTools ? await usageTools.hashAiRequest({ messages, jsonMode }) : "";
  const ttl = usage && usageTools ? await usageTools.operationCacheTtl(usage.operation) : 0;
  const cached = ttl > 0 && usageTools ? await usageTools.readAiCache(requestHash) : null;
  if (cached !== null) return cached;
  const ticket =
    usage && usageTools
      ? await usageTools.reserveAiUsage({ ...usage, model: GEMINI_TEXT_MODEL, requestHash })
      : null;
  let text: string | null = null;
  let usageTokens: { inputTokens?: number; outputTokens?: number } = {};
  const onUsage = (reported: { inputTokens?: number; outputTokens?: number }) => {
    usageTokens = reported;
  };
  try {
    text = lovable
      ? await lovable.callLovableTalking(messages, onUsage, signal)
      : await callGemini(messages, jsonMode, onUsage, signal);
  } catch (err) {
    if (ticket && usageTools) {
      await usageTools.finishAiUsage(ticket, {
        success: false,
        errorCode: signal?.aborted
          ? "timeout"
          : err instanceof GeminiError
            ? `gemini_${err.status}`
            : lovable && err instanceof lovable.LovableChatError
              ? `lovable_${err.status}`
              : "gemini_error",
        errorMessage: err instanceof Error ? err.message : "Google Gemini failed",
      });
    }
    if (err instanceof AiError) throw err;
    if (signal?.aborted)
      throw new AiError(504, "Voice processing is taking longer than expected. Please try again.");
    const message =
      err instanceof Error ? err.message : "Google Gemini could not answer right now.";
    const status =
      err instanceof GeminiError || (lovable && err instanceof lovable.LovableChatError)
        ? (err as { status: number }).status
        : 503;
    throw new AiError(status, message);
  }

  if (text === null) {
    if (ticket && usageTools)
      await usageTools.finishAiUsage(ticket, { success: false, errorCode: "not_configured" });
    throw new AiError(500, "Your Google Gemini key is not connected yet.");
  }
  if (ticket && usageTools)
    await usageTools.finishAiUsage(ticket, { success: true, ...usageTokens });

  if (usage && usageTools && ttl > 0) {
    await usageTools.writeAiCache({
      cacheKey: requestHash,
      operation: usage.operation,
      model: GEMINI_TEXT_MODEL,
      responseText: text,
      ttlSeconds: ttl,
    });
  }
  return text;
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
