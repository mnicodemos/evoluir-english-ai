/**
 * The current study day for the student (Brazil time), so a new set of daily
 * content appears at midnight in São Paulo instead of midnight UTC (21:00 local).
 */
export const STUDY_TIME_ZONE = "America/Sao_Paulo";

export function studyToday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * The instant the current study day began (00:00 in São Paulo), as a UTC ISO
 * string comparable with stored timestamps. Brazil has no daylight saving time,
 * so the offset is fixed at -03:00.
 */
export function studyDayStartIso(date: Date = new Date()): string {
  return new Date(`${studyToday(date)}T00:00:00-03:00`).toISOString();
}

/** Today's weekday in São Paulo, in the student's language ("Friday", "Sexta-feira"). */
export function studyWeekday(lang: "en" | "pt", date: Date = new Date()) {
  const name = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    weekday: "long",
    timeZone: STUDY_TIME_ZONE,
  }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
