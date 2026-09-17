/**
 * A day only counts as a study day when the student finishes a lesson (including the
 * final test) or completes an AI Talking session. The streak and the frequency
 * calendar both use this single list so they can never disagree.
 */
export const STUDY_DAY_ACTIVITY_TYPES = ["lesson", "final_test", "conversation"] as const;

export function countsAsStudyDay(activityType: string) {
  return (STUDY_DAY_ACTIVITY_TYPES as readonly string[]).includes(activityType);
}
