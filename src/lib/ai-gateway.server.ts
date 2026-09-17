const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function callGateway(messages: Msg[], jsonMode = false): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(500, "AI is not configured yet.");

  // Always prefer the workspace's own Google Gemini key when it is connected.
  try {
    const { callGemini } = await import("./gemini.server");
    const viaGemini = await callGemini(messages, jsonMode);
    if (viaGemini) return viaGemini;
  } catch (err) {
    // Gemini being busy or down must never break the feature: keep going and let
    // the Lovable AI gateway below answer instead.
    if (err instanceof AiError) throw err;
    console.error("Gemini unavailable, using Lovable AI instead", err);
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new AiError(429, "Too many requests right now. Please try again in a moment.");
    if (res.status === 402)
      throw new AiError(402, "The AI credits for this workspace ran out. Please top up to keep practicing.");
    throw new AiError(res.status, `AI Talking could not answer (${res.status}). ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
