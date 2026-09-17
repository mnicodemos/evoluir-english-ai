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
): Promise<string> {
  const { callGemini, GEMINI_TEXT_MODEL, GeminiError } = await import("./gemini.server");
  const usageTools = usage ? await import("./ai-usage.server") : null;
  const requestHash = usageTools ? await usageTools.hashAiRequest({ messages, jsonMode }) : "";
  const ticket = usage && usageTools
    ? await usageTools.reserveAiUsage({ ...usage, model: GEMINI_TEXT_MODEL, requestHash })
    : null;
  let text: string | null = null;
  try {
    text = await callGemini(messages, jsonMode);
  } catch (err) {
    if (ticket && usageTools) {
      await usageTools.finishAiUsage(ticket, {
        success: false,
        errorCode: err instanceof GeminiError ? `gemini_${err.status}` : "gemini_error",
        errorMessage: err instanceof Error ? err.message : "Google Gemini failed",
      });
    }
    if (err instanceof AiError) throw err;
    const message = err instanceof Error ? err.message : "Google Gemini could not answer right now.";
    throw new AiError(err instanceof GeminiError ? err.status : 503, message);
  }

  if (text === null) {
    if (ticket && usageTools) await usageTools.finishAiUsage(ticket, { success: false, errorCode: "not_configured" });
    throw new AiError(500, "Your Google Gemini key is not connected yet.");
  }
  if (ticket && usageTools) await usageTools.finishAiUsage(ticket, { success: true });
  return text;
}


export function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
