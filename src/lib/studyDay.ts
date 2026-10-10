/**
 * The study-day rule (user decisions; migrations 0027, 0051 and 0057). The
 * database's credit_study_day is the only writer of the streak and stores the
 * days it credits in study_days (migration 0063), which the Rhythm and
 * frequency views read; this mirror is their fallback before that migration
 * and keeps the thresholds tested. Change them together with credit_study_day.
 */
export const STUDY_DAY_RULE = { writing: 3, listening: 3, reviewedWords: 10 } as const;

/** One study day's evidence, already grouped by São Paulo date. */
export type StudyDayEvidence = {
  writing: number;
  listening: number;
  reviewedWords: number;
  lessonCompleted: boolean;
  conversation: boolean;
  /** Every goal step of that day done (a day with steps, none left open). */
  goalsDone: boolean;
};

export function qualifiesAsStudyDay(day: StudyDayEvidence): boolean {
  return (
    day.writing >= STUDY_DAY_RULE.writing ||
    day.listening >= STUDY_DAY_RULE.listening ||
    day.reviewedWords >= STUDY_DAY_RULE.reviewedWords ||
    day.lessonCompleted ||
    day.conversation ||
    day.goalsDone
  );
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
  "teacher",
  "mistakes_review",
  "video_call",
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
  teacher: "Writing",
  mistakes_review: "Writing",
  video_call: "Talking",
} as const satisfies Record<string, "Listening" | "Reading" | "Talking" | "Writing">;

export type SkillBucket = (typeof ACTIVITY_SKILL_BUCKETS)[keyof typeof ACTIVITY_SKILL_BUCKETS];

export function skillBucketOf(activityType: string): SkillBucket | null {
  return (ACTIVITY_SKILL_BUCKETS as Record<string, SkillBucket>)[activityType] ?? null;
}
