type Msg = { role: "system" | "user" | "assistant"; content: string };
import type { AiOperation } from "./ai-usage.server";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Below the 90 s abandoned-record limit, far above normal latency (3–5 s). */
export const AI_CALL_TIMEOUT_MS = 60_000;

/**
 * All AI usage runs on the workspace's own Google Gemini key.
 * There is no third-party fallback on purpose.
 */
export async function callGateway(
  messages: Msg[],
  jsonMode = false,
  usage?: {
    userId: string;
    operation: AiOperation;
    /** Stable, user-independent cache key (default: hash of the messages). */
    cacheKey?: string;
    /** The caller already looked this key up and missed; skip the second read. */
    cacheChecked?: boolean;
    /** No "thinking" step: for short, simple answers (see GeminiSpeed). */
    fast?: boolean;
    /** Cap on the answer length, in tokens. */
    maxOutputTokens?: number;
  },
  callerSignal?: AbortSignal,
): Promise<string> {
  // Every AI call has a hard time limit, so a hung provider response can never
  // leave its usage record "running" (the record is always closed below).
  const timeoutSignal = AbortSignal.timeout(AI_CALL_TIMEOUT_MS);
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
  const {
    callGemini,
    GEMINI_TEXT_MODEL: geminiModel,
    GeminiError,
  } = await import("./gemini.server");
  // AI Speaking and Vocabulary generation run on Google Gemini like every
  // other feature (user request, 2026-10-04: migrate both to the Gemini API).
  const useLovable = false;
  const lovable = useLovable ? await import("./lovable-chat.server") : null;
  const GEMINI_TEXT_MODEL = lovable
    ? usage?.operation === "vocabulary_generation"
      ? lovable.LOVABLE_VOCABULARY_MODEL
      : lovable.LOVABLE_TALKING_MODEL
    : geminiModel;
  const usageTools = usage ? await import("./ai-usage.server") : null;
  const requestHash = usageTools ? await usageTools.hashAiRequest({ messages, jsonMode }) : "";
  const cacheKey = usage?.cacheKey ?? requestHash;
  // The three reads before the call run together instead of one after the
  // other: the ai_limits row (TTL + limits, read once), the cache and the
  // closing of abandoned usage records.
  const [limitRow, cachedRead] =
    usage && usageTools
      ? await Promise.all([
          usageTools.loadAiLimit(usage.operation),
          usage.cacheChecked ? Promise.resolve(null) : usageTools.readAiCache(cacheKey),
          usageTools.releaseAbandonedAiUsage(usage.userId, usage.operation),
        ])
      : [null, null];
  const ttl = limitRow?.cache_ttl_seconds ?? 0;
  const cached = ttl > 0 ? cachedRead : null;
  if (cached !== null) return cached;
  const ticket =
    usage && usageTools
      ? await usageTools.reserveAiUsage({
          ...usage,
          model: GEMINI_TEXT_MODEL,
          requestHash,
          limit: limitRow,
          abandonedReleased: true,
        })
      : null;
  let text: string | null = null;
  let usageTokens: { inputTokens?: number; outputTokens?: number } = {};
  const onUsage = (reported: { inputTokens?: number; outputTokens?: number }) => {
    usageTokens = reported;
  };
  try {
    text = lovable
      ? await lovable.callLovableTalking(messages, onUsage, signal, GEMINI_TEXT_MODEL)
      : await callGemini(messages, jsonMode, onUsage, signal, {
          ...(usage?.fast ? { fast: true } : {}),
          ...(usage?.maxOutputTokens ? { maxOutputTokens: usage.maxOutputTokens } : {}),
        });
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
      throw new AiError(
        504,
        usage?.operation === "tts" ||
          usage?.operation === "transcription" ||
          usage?.operation === "talking"
          ? "Voice processing is taking longer than expected. Please try again."
          : "The AI service is busy right now. Please try again in a few minutes.",
      );
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
  // Closing the usage record and saving the cache happen after the answer is
  // returned (waitUntil keeps them running), so the student does not wait on
  // these writes.
  if (usage && usageTools) {
    const tools = usageTools;
    const answer = text;
    const { keepAlive } = await import("./keepAlive.server");
    void keepAlive(
      Promise.all([
        ticket ? tools.finishAiUsage(ticket, { success: true, ...usageTokens }) : null,
        ttl > 0
          ? tools.writeAiCache({
              cacheKey,
              operation: usage.operation,
              model: GEMINI_TEXT_MODEL,
              responseText: answer,
              ttlSeconds: ttl,
            })
          : null,
      ]),
    );
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
