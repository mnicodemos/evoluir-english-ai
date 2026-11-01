/**
 * The daily goal over the last seven days (owner request, 2026-11-01: an
 * evolution line under Today's Progress). Each day is the share of the
 * student's daily minutes goal reached that day, capped at 100%, and the
 * average is the mean of those seven shares, days without study included.
 * Days follow the device's local midnight, like Today's Progress.
 */
export type GoalTrendDay = { key: string; date: Date; minutes: number; percent: number };

export const GOAL_TREND_DAYS = 7;

/** Local midnight of `now`, `back` days earlier. */
export function trendDayStart(now: Date, back: number): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  return day;
}

function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dailyGoalTrend(
  rows: { created_at: string; duration_minutes: number | null }[],
  goalMinutes: number,
  now: Date,
): { days: GoalTrendDay[]; average: number } {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(new Date(row.created_at));
    byDay.set(key, (byDay.get(key) ?? 0) + (row.duration_minutes ?? 0));
  }
  const days: GoalTrendDay[] = [];
  for (let back = GOAL_TREND_DAYS - 1; back >= 0; back -= 1) {
    const date = trendDayStart(now, back);
    const key = dayKey(date);
    const minutes = byDay.get(key) ?? 0;
    const percent = goalMinutes > 0 ? Math.min(100, Math.round((minutes / goalMinutes) * 100)) : 0;
    days.push({ key, date, minutes, percent });
  }
  const average = Math.round(days.reduce((sum, d) => sum + d.percent, 0) / days.length);
  return { days, average };
}
