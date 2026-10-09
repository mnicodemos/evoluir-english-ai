/**
 * Admin: does a correction stick? For each source of "My mistakes" (AI
 * Teacher, Writing), how many were saved, how many were reviewed at least
 * once, and how many of those the student got right at the last review
 * (review_step above 0: a wrong answer sends the mistake back to step 0).
 */
export type MistakeReviewRow = {
  source: string;
  review_step: number;
  last_reviewed_at: string | null;
};

export type MistakeSourceStats = {
  source: "teacher" | "writing";
  saved: number;
  reviewed: number;
  retained: number;
  /** Share of reviewed mistakes answered right at the last review; null when none reviewed. */
  percent: number | null;
};

export function mistakeReviewReport(rows: MistakeReviewRow[]): MistakeSourceStats[] {
  return (["teacher", "writing"] as const).map((source) => {
    const mine = rows.filter((row) => row.source === source);
    const reviewed = mine.filter((row) => row.last_reviewed_at !== null);
    const retained = reviewed.filter((row) => row.review_step > 0).length;
    return {
      source,
      saved: mine.length,
      reviewed: reviewed.length,
      retained,
      percent: reviewed.length ? Math.round((retained / reviewed.length) * 100) : null,
    };
  });
}
