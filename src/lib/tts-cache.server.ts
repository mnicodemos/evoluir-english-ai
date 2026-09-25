// Shared server-side TTS cache in a private Storage bucket. Only the server
// (service role) reads/writes it; the bucket has no public URL and no user policies.
import { isValidTtsEntry } from "./ttsCacheKey";

const BUCKET = "tts-cache";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readTtsCache(key: string): Promise<string[] | null> {
  try {
    const db = await admin();
    const { data, error } = await db.storage.from(BUCKET).download(`${key}.json`);
    if (error || !data) return null;
    const parsed: unknown = JSON.parse(await data.text());
    return isValidTtsEntry(parsed) ? parsed.chunks : null;
  } catch {
    return null;
  }
}

/** Best effort: a storage failure never breaks the audio the student already received. */
export async function writeTtsCache(key: string, chunks: string[]): Promise<void> {
  const entry = { chunks };
  if (!isValidTtsEntry(entry)) return;
  try {
    const db = await admin();
    const { error } = await db.storage.from(BUCKET).upload(`${key}.json`, JSON.stringify(entry), {
      contentType: "application/json",
      upsert: true,
    });
    if (error) console.error(`[tts-cache] write failed: ${error.message}`);
  } catch (error) {
    console.error(`[tts-cache] write failed: ${error instanceof Error ? error.message : error}`);
  }
}
