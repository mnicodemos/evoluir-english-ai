// Deterministic key for the shared server-side TTS cache. Contains no user data,
// so identical audio requests from different students reuse the same file.

export const TTS_CACHE_VERSION = "v1";

/** Conservative normalization: only Unicode form and whitespace; punctuation and words stay. */
export function normalizeTtsText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export async function ttsCacheKey(input: {
  text: string;
  voice: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const material = JSON.stringify([
    TTS_CACHE_VERSION,
    input.model,
    input.voice,
    input.prompt,
    normalizeTtsText(input.text),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A cached entry is only valid when it is a non-empty list of non-empty base64 chunks. */
export function isValidTtsEntry(value: unknown): value is { chunks: string[] } {
  if (!value || typeof value !== "object") return false;
  const chunks = (value as { chunks?: unknown }).chunks;
  return (
    Array.isArray(chunks) &&
    chunks.length > 0 &&
    chunks.every((c) => typeof c === "string" && c.length > 0 && /^[A-Za-z0-9+/=]+$/.test(c))
  );
}
