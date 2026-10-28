/**
 * Small display helpers for the lesson video reinforcement block. They only read
 * lesson text that already exists — no new score, evidence or pedagogical rule.
 */

/** Extracts the YouTube id of a watch/short/embed URL, or null when it is not YouTube. */
export function youtubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

/** Extracts a numeric Vimeo id from a public or unlisted Vimeo URL. */
export function vimeoVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/(^|\.)vimeo\.com$/i.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([A-Za-z0-9]+))?\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Builds the Vimeo player URL and preserves the privacy hash for unlisted videos. */
export function vimeoEmbedUrl(url: string | null | undefined): string | null {
  const id = vimeoVideoId(url);
  if (!id || !url) return null;
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/^\/(?:video\/)?\d+\/([A-Za-z0-9]+)\/?$/);
    const hash = parsed.searchParams.get("h") ?? pathMatch?.[1] ?? null;
    const query = hash ? "?h=" + encodeURIComponent(hash) : "";
    return "https://player.vimeo.com/video/" + id + query;
  } catch {
    return null;
  }
}

/** Builds a safe embed URL for supported Vimeo and YouTube lesson videos. */
export function lessonVideoEmbedUrl(url: string | null | undefined): string | null {
  const vimeo = vimeoEmbedUrl(url);
  if (vimeo) return vimeo;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/(^|\\.)youtube\\.com$/i.test(parsed.hostname) && parsed.hostname !== "youtu.be") {
      return null;
    }
    const id = youtubeVideoId(url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
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
  return (
    youtubeVideoId(url) !== null ||
    vimeoVideoId(url) !== null ||
    /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url)
  );
}

/**
 * Turns the existing lesson summary into 1 to 3 short review points.
 * It is deliberately deterministic and never changes the lesson score.
 */
export function videoReviewPoints(summary: string | null | undefined): string[] {
  if (!summary) return [];
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 20)
    .slice(0, 3);
}

export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  return String(minutes) + " min";
}
