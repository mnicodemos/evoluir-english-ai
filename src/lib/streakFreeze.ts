/**
 * Streak protection ("congelar sequência"): one missed day per week (Monday to
 * Sunday, São Paulo) does not break the streak. The database applies the rule
 * in credit_study_day; these helpers only mirror it for display.
 */

const DAY_MS = 86_400_000;

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week that contains `day` (YYYY-MM-DD). */
export function weekStartOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** True when no protection was used yet in the week of the missed day. */
export function freezeAvailable(usedOn: string | null | undefined, missedDay: string): boolean {
  return !usedOn || usedOn < weekStartOf(missedDay);
}

/**
 * Whether the streak is still alive today: the last credited day was today or
 * yesterday, or it was the day before yesterday and yesterday can be covered by
 * this week's protection.
 */
export function streakAlive(
  lastActivityDate: string | null,
  freezeUsedOn: string | null | undefined,
  today: string,
): { alive: boolean; protectedDay: string | null } {
  if (!lastActivityDate) return { alive: false, protectedDay: null };
  const yesterday = addDays(today, -1);
  if (lastActivityDate === today || lastActivityDate === yesterday) {
    // The protection already covered a day right before the last study day.
    return {
      alive: true,
      protectedDay: freezeUsedOn === addDays(lastActivityDate, -1) ? freezeUsedOn : null,
    };
  }
  if (lastActivityDate === addDays(today, -2) && freezeAvailable(freezeUsedOn, yesterday)) {
    return { alive: true, protectedDay: yesterday };
  }
  return { alive: false, protectedDay: null };
}
