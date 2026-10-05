/**
 * Weekly EVO report: a Sunday push that sums up the student's last seven study
 * days. Pure rules (window, day and wording) so they can be tested; the cron
 * route only gathers the numbers and sends.
 */
import { STUDY_TIME_ZONE, studyDayStartIso } from "./today";

export type WeeklyStats = {
  minutes: number;
  activities: number;
  lessons: number;
  words: number;
  mistakesReviewed: number;
  streakDays: number;
  /** Final position in the weekly league, only for students who joined it. */
  league?: { position: number; total: number; level: string } | null;
};

/**
 * Positions like the database's rank(): equal XP shares a position and the
 * next one skips (100, 80, 80, 50 → 1, 2, 2, 4).
 */
export function leaguePositions(entries: { id: string; xp: number }[]) {
  const sorted = [...entries].sort((a, b) => b.xp - a.xp);
  const positions = new Map<string, number>();
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1];
    positions.set(
      entry.id,
      previous && previous.xp === entry.xp ? positions.get(previous.id)! : index + 1,
    );
  });
  return positions;
}

function leagueSentence(league: NonNullable<WeeklyStats["league"]>) {
  const medal = ["🥇", "🥈", "🥉"][league.position - 1] ?? "🏆";
  return ` Liga ${league.level.toUpperCase()}: ${league.position}º de ${league.total} ${medal}. Nova semana começa amanhã!`;
}

const DAY_MS = 86_400_000;

/** Start of the report window: 00:00 in São Paulo six study days ago (seven days with today). */
export function weekStartIso(now = new Date()): string {
  return studyDayStartIso(new Date(now.getTime() - 6 * DAY_MS));
}

/** The report goes out on Sunday, in the student's study time zone. */
export function isWeeklyReportDay(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDY_TIME_ZONE,
    weekday: "short",
  }).format(now);
  return weekday === "Sun";
}

/** The league ranking restarts on Monday (study time zone). */
export function isLeagueResetDay(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDY_TIME_ZONE,
    weekday: "short",
  }).format(now);
  return weekday === "Mon";
}

/** Line added to Monday's word of the day for students in the league. */
export const LEAGUE_RESET_LINE = "🏆 Nova semana na liga: o ranking recomeçou. Some XP hoje!";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function weeklyReportMessage(stats: WeeklyStats) {
  const title = "Sua semana com a EVO 📊";
  if (stats.activities === 0 && stats.lessons === 0 && stats.words === 0) {
    return {
      title,
      body: "Nenhuma atividade nesta semana. Que tal recomeçar amanhã com 10 minutos? A EVO preparou seu plano.",
      path: "/study-plan",
    };
  }
  const parts = [
    plural(stats.minutes, "minuto", "minutos"),
    plural(stats.lessons, "lição", "lições"),
    plural(stats.words, "palavra nova", "palavras novas"),
  ];
  if (stats.mistakesReviewed > 0)
    parts.push(plural(stats.mistakesReviewed, "erro revisado", "erros revisados"));
  const streak =
    stats.streakDays > 1
      ? ` Streak de ${stats.streakDays} dias 🔥`
      : " Continue firme na próxima semana!";
  const league = stats.league ? leagueSentence(stats.league) : "";
  return {
    title,
    body: `${parts.join(" · ")}.${streak}${league}`.slice(0, 280),
    path: "/progress",
  };
}
