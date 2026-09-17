type Msg = { role: "system" | "user" | "assistant"; content: string };

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
export async function callGateway(messages: Msg[], jsonMode = false): Promise<string> {
  const { callGemini } = await import("./gemini.server");
  let text: string | null = null;
  try {
    text = await callGemini(messages, jsonMode);
  } catch (err) {
    if (err instanceof AiError) throw err;
    const message = err instanceof Error ? err.message : "Google Gemini could not answer right now.";
    throw new AiError(503, message);
  }

  if (text === null) {
    throw new AiError(500, "Your Google Gemini key is not connected yet.");
  }
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
