/**
 * "Your week" (product review, 2026-10-31: with one student per level the
 * weekly ranking only said "you are alone"): the student's XP this week against
 * last week and their best earlier week, from weekly_league_history (newest
 * week first). The ranking among students shows again once the student's
 * league has RANKING_MIN_MEMBERS students taking part.
 */
export const RANKING_MIN_MEMBERS = 5;

export type WeekXpSummary = {
  thisWeek: number;
  lastWeek: number;
  /** The best of the earlier weeks (0 with none). */
  best: number;
  /** This week minus last week. */
  delta: number;
  /** A new personal best: more XP than every earlier week, and some XP. */
  record: boolean;
};

export function weekXpSummary(weeks: { xp: number }[], currentXp?: number): WeekXpSummary {
  const thisWeek = currentXp ?? weeks[0]?.xp ?? 0;
  const earlier = weeks.slice(1).map((week) => week.xp);
  const lastWeek = earlier[0] ?? 0;
  const best = earlier.length ? Math.max(...earlier) : 0;
  return {
    thisWeek,
    lastWeek,
    best,
    delta: thisWeek - lastWeek,
    record: thisWeek > 0 && earlier.some((xp) => xp > 0) && thisWeek > best,
  };
}

/**
 * The Weekly XP icon is green while the week is going up (owner report,
 * 2026-10-31: grey on the Dashboard, green on the page): some XP this week and
 * at least last week's. Grey with no XP yet or below last week.
 */
export function weekXpRising(week: { thisWeek: number; delta: number }): boolean {
  return week.thisWeek > 0 && week.delta >= 0;
}

/** Whether the ranking among students is worth showing. */
export function rankingOpen(members: number): boolean {
  return members >= RANKING_MIN_MEMBERS;
}
