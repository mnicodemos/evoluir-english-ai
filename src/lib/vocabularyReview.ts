/**
 * Spaced review ladder for "I know it" on the Vocabulary page.
 * mastery_level stores the step; next_review_at stores when it is due.
 */
export const REVIEW_MASTERY = [0, 20, 40, 60, 75, 90, 100] as const;
/** Days until the next review after reaching each step (index = step). */
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 0] as const;
export const LEARNED_MASTERY = 75;
export const MAX_STEP = REVIEW_MASTERY.length - 1;
export const DAILY_REVIEW_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Step from a stored mastery_level (highest step whose mastery is <= value). */
export function stepFromMastery(mastery: number | null | undefined): number {
  const m = mastery ?? 0;
  let step = 0;
  for (let i = 0; i < REVIEW_MASTERY.length; i++) if (m >= REVIEW_MASTERY[i]!) step = i;
  return step;
}

export type ReviewState = {
  mastery_level: number | null;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
};

/** A word is due when it has a schedule that has arrived and is not fully mastered. */
export function isDue(state: ReviewState | undefined, now = new Date()): boolean {
  if (!state?.next_review_at) return false;
  if ((state.mastery_level ?? 0) >= 100) return false;
  return new Date(state.next_review_at).getTime() <= now.getTime();
}

/** Whether "I know it" should move the word up a step right now. */
export function canAdvance(state: ReviewState | undefined, now = new Date()): boolean {
  if (!state || (state.mastery_level ?? 0) <= 0) return true;
  if ((state.mastery_level ?? 0) >= 100) return false;
  if (!state.next_review_at) return true;
  return isDue(state, now);
}

export function advance(state: ReviewState | undefined, now = new Date()) {
  const step = Math.min(MAX_STEP, stepFromMastery(state?.mastery_level) + 1);
  const days = REVIEW_INTERVAL_DAYS[step]!;
  return {
    mastery_level: REVIEW_MASTERY[step]!,
    next_review_at: days > 0 ? new Date(now.getTime() + days * DAY_MS).toISOString() : null,
  };
}

/** Passed pronunciation (>= 70%): straight to the learned step, review in 30 days. */
export function markPronounced(now = new Date()) {
  const step = 5; // mastery 90
  return {
    mastery_level: REVIEW_MASTERY[step]!,
    next_review_at: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[step]! * DAY_MS).toISOString(),
  };
}

/** Failed review: back two steps (never below step 1), due again tomorrow. */
export function fallBack(state: ReviewState | undefined, now = new Date()) {
  const step = Math.max(1, stepFromMastery(state?.mastery_level) - 2);
  return {
    mastery_level: REVIEW_MASTERY[step]!,
    next_review_at: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[1]! * DAY_MS).toISOString(),
  };
}
