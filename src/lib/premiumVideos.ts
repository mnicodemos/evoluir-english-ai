/**
 * Premium extra videos (owner decision, 2026-10-31): any number of Vimeo
 * videos per level, each with its own title, not tied to a unit or lesson.
 * Stored in premium_level_videos (migration 0101), read only through the
 * server, which hands out the links only to Premium students.
 */
export const PREMIUM_VIDEO_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export type PremiumVideoLevel = (typeof PREMIUM_VIDEO_LEVELS)[number];

/** A regular video or a short (vertical, its own "Shorts" tab; migration 0102). */
export const PREMIUM_VIDEO_KINDS = ["video", "short"] as const;
export type PremiumVideoKind = (typeof PREMIUM_VIDEO_KINDS)[number];

export type PremiumVideoRow = {
  id: string;
  level: string;
  title: string;
  video_url: string;
  created_at: string;
  /** Missing before migration 0102: every row is then a regular video. */
  kind?: string | null;
};

export type PremiumVideo = {
  id: string;
  level: PremiumVideoLevel;
  title: string;
  kind: PremiumVideoKind;
  /** Null for a free student: the link is handed out only to Premium. */
  url: string | null;
};

export function isPremiumVideoLevel(level: string): level is PremiumVideoLevel {
  return (PREMIUM_VIDEO_LEVELS as readonly string[]).includes(level);
}

/** Rows to the page's list: by level (A1 first), then oldest first within it. */
export function premiumVideoList(rows: PremiumVideoRow[], withLinks: boolean): PremiumVideo[] {
  return rows
    .filter((row) => isPremiumVideoLevel(row.level))
    .sort((a, b) =>
      a.level === b.level
        ? a.created_at.localeCompare(b.created_at)
        : PREMIUM_VIDEO_LEVELS.indexOf(a.level as PremiumVideoLevel) -
          PREMIUM_VIDEO_LEVELS.indexOf(b.level as PremiumVideoLevel),
    )
    .map((row) => ({
      id: row.id,
      level: row.level as PremiumVideoLevel,
      title: row.title,
      kind: row.kind === "short" ? "short" : "video",
      url: withLinks ? row.video_url : null,
    }));
}

const REEL_PATH = /^\/(?:[A-Za-z0-9_.]+\/)?(?:reels?|p)\/([A-Za-z0-9_-]{5,40})\/?/;

/**
 * An Instagram Reel link in one canonical form (owner request, 2026-10-31: the
 * Shorts tab takes Reels), or null: instagram.com/reel/<code>, /reels/<code>,
 * /p/<code> or /<user>/reel/<code>, any query dropped.
 */
export function canonicalReelUrl(input: string): string | null {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== "https:") return null;
    if (!/^(?:www\.)?instagram\.com$/i.test(parsed.hostname)) return null;
    const code = parsed.pathname.match(REEL_PATH)?.[1];
    return code ? `https://www.instagram.com/reel/${code}/` : null;
  } catch {
    return null;
  }
}

/** The Instagram player of a Reel link (its /embed page), or null for any other link. */
export function reelEmbedUrl(url: string | null | undefined): string | null {
  const canonical = url ? canonicalReelUrl(url) : null;
  return canonical ? `${canonical}embed/` : null;
}
