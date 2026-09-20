/**
 * A day only counts as a study day when the student finishes a lesson (including the
 * final test) or completes an AI Talking session. The streak and the frequency
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
