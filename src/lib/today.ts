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
