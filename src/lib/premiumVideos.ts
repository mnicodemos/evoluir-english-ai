/**
 * Premium extra videos (owner decision, 2026-10-31): any number of Vimeo
 * videos per level, each with its own title, not tied to a unit or lesson.
 * Stored in premium_level_videos (migration 0101), read only through the
 * server, which hands out the links only to Premium students.
 */
export const PREMIUM_VIDEO_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export type PremiumVideoLevel = (typeof PREMIUM_VIDEO_LEVELS)[number];

export type PremiumVideoRow = {
  id: string;
  level: string;
  title: string;
  video_url: string;
  created_at: string;
};

export type PremiumVideo = {
  id: string;
  level: PremiumVideoLevel;
  title: string;
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
      url: withLinks ? row.video_url : null,
    }));
}
