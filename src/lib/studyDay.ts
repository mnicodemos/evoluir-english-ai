/**
 * A day only counts as a study day when the student finishes a lesson (including the
 * final test) or completes an AI Speaking session. The streak and the frequency
 * calendar both use this single list so they can never disagree.
 */
export const STUDY_DAY_ACTIVITY_TYPES = ["lesson", "final_test", "conversation"] as const;

export function countsAsStudyDay(activityType: string) {
  return (STUDY_DAY_ACTIVITY_TYPES as readonly string[]).includes(activityType);
}

/**
 * Activity types that represent completed learning outcomes. The daily goal card
 * only counts these, excluding residual timer/navigation records such as the
 * "*_practice" telemetry rows written while a session is still open.
 */
export const LEARNING_ACTIVITY_TYPES = [
  "lesson",
  "final_test",
  "conversation",
  "listening",
  "writing",
  "vocabulary",
  "flashcards",
] as const;

export function countsAsLearningMinutes(activityType: string) {
  return (LEARNING_ACTIVITY_TYPES as readonly string[]).includes(activityType);
}

/** True when a timestamp falls on the same local day as `dayStart` (its 00:00). */
export function isTimestampToday(iso: string | null | undefined, dayStart: Date): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  const nextDay = dayStart.getTime() + 86_400_000;
  return time >= dayStart.getTime() && time < nextDay;
}

/**
 * Structural rows the Today's Progress aggregation needs — table-free so tests
 * never touch the database. Each row carries the timestamp that proves the
 * activity happened today plus the mastery/result field that proves it counts.
 */
export type StudyDayRows = {
  lessons: { completed_at: string | null; video_completed_at: string | null }[];
  cards: { mastery_level: number; times_reviewed: number; last_reviewed_at: string | null }[];
  words: { mastery_level: number; last_reviewed_at: string | null }[];
  quizzes: { score: number; created_at: string | null }[];
};

/**
 * Aggregates only what the student really learned/practised today. Opening a
 * screen never counts: each metric needs its completion timestamp from today
 * (lesson finished, video finished, word/card mastered today, quiz graded
 * today). Same thresholds as the existing cumulative aggregation (mastery 70).
 */
export function todayStudyMetrics(rows: StudyDayRows, dayStart: Date) {
  const lessonsCompleted = rows.lessons.filter((l) =>
    isTimestampToday(l.completed_at, dayStart),
  ).length;
  const videosWatched = rows.lessons.filter((l) =>
    isTimestampToday(l.video_completed_at, dayStart),
  ).length;
  const vocabularyMastered =
    rows.words.filter((w) => w.mastery_level > 0 && isTimestampToday(w.last_reviewed_at, dayStart))
      .length +
    rows.cards.filter(
      (c) =>
        c.times_reviewed > 0 &&
        c.mastery_level >= 70 &&
        isTimestampToday(c.last_reviewed_at, dayStart),
    ).length;
  const quizScores = rows.quizzes
    .filter((q) => isTimestampToday(q.created_at, dayStart))
    .map((q) => q.score);
  const quizAverage = quizScores.length
    ? Math.round(quizScores.reduce((sum, value) => sum + value, 0) / quizScores.length)
    : 0;
  return { lessonsCompleted, videosWatched, vocabularyMastered, quizAverage };
}

/**
 * Every activity type the app records, mapped to the skill bucket used by the
 * charts. Practice time (including abandoned sessions) is counted exactly once,
 * so the chart totals always match the minutes stored for the day.
 */
export const ACTIVITY_SKILL_BUCKETS = {
  listening: "Listening",
  listening_practice: "Listening",
  vocabulary: "Reading",
  flashcards: "Reading",
  lesson: "Reading",
  lesson_practice: "Reading",
  final_test: "Reading",
  final_test_practice: "Reading",
  conversation: "Talking",
  conversation_practice: "Talking",
  writing: "Writing",
  writing_practice: "Writing",
} as const satisfies Record<string, "Listening" | "Reading" | "Talking" | "Writing">;

export type SkillBucket = (typeof ACTIVITY_SKILL_BUCKETS)[keyof typeof ACTIVITY_SKILL_BUCKETS];

export function skillBucketOf(activityType: string): SkillBucket | null {
  return (ACTIVITY_SKILL_BUCKETS as Record<string, SkillBucket>)[activityType] ?? null;
}
