const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key";
// Use the lighter model for short tutoring exchanges and keep the larger
// model as a quota fallback. This avoids exhausting the smaller free quota
// assigned to the larger model during normal speaking practice.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];

export type GeminiMessage = { role: "system" | "user" | "assistant"; content: string };

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

export async function openGeminiStream(messages: GeminiMessage[]): Promise<Response | null> {
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
  });
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
): Promise<string | null> {
  const credentials = connectorCredentials();
  if (!credentials) return null;
  const body = requestBody(messages, jsonMode);

  let lastStatus = 503;
  for (const model of MODELS) {
    const res = await fetch(`${GATEWAY_URL}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.lovableKey}`,
        "X-Connection-Api-Key": credentials.connectionKey,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      lastStatus = res.status;
      const errorBody = await res.text();
      console.error(
        `Gemini request failed [${res.status}] on ${model}: ${errorBody.slice(0, 300)}`,
      );
      // Quota/rate and temporary upstream failures can be model-specific.
      // Terminal request errors would fail identically on the next model.
      if (res.status === 429 || res.status >= 500) continue;
      break;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (text) return text;
  }

  throw new Error(
    lastStatus === 429
      ? "Your Google Gemini limit is temporarily busy. Please try again in a moment."
      : "Google Gemini could not answer right now. Please try again in a moment.",
  );
}
