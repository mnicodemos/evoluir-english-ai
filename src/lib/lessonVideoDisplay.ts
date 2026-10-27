/**
 * Small display helpers for the lesson video reinforcement block. They only read
 * lesson text that already exists — no new score, evidence or pedagogical rule.
 */

/** Extracts the YouTube id of a watch/short/embed URL, or null when it is not YouTube. */
export function youtubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

/** Extracts a numeric Vimeo id from a public or player Vimeo URL. */
export function vimeoVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/(^|\.)vimeo\.com$/i.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** True when the URL can be played by the existing lesson player. */
export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return youtubeVideoId(url) !== null || vimeoVideoId(url) !== null || /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url);
}

/**
 * Turns the existing lesson summary into 1 to 3 short review points shown under
 * the player ("What you just reviewed"). No new content is invented.
 */
export function videoReviewPoints(summary: string | null | undefined, max = 3): string[] {
  if (!summary) return [];
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, max);
}

/** Formats a stored duration in seconds as "5 min" for the video header. */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}
