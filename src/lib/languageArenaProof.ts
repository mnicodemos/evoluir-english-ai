export const LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS = 3;
export const LANGUAGE_ARENA_LISTENING_PASS_SCORE = 70;

/** Monday 00:00 in America/Sao_Paulo, represented as an ISO instant. */
export function leagueWeekStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const localMonday = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
  // Brazil's São Paulo timezone is UTC-03:00 (no seasonal DST in current rules).
  return new Date(`${localMonday}T03:00:00.000Z`).toISOString();
}

/** Count saved activity scores meeting the mission threshold, capped at its goal. */
export function countQualifiedListeningParts(scores: Array<number | null>): number {
  return Math.min(
    LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS,
    scores.filter((score) => score !== null && score >= LANGUAGE_ARENA_LISTENING_PASS_SCORE).length,
  );
}
