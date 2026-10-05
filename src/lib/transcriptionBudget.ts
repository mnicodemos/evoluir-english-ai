/**
 * One overall time budget for a transcription request. Every provider attempt
 * (Lovable primary, Gemini fallbacks and retries) draws from it, so the
 * student never waits for the sum of all per-attempt limits.
 */
export const TRANSCRIPTION_TOTAL_BUDGET_MS = 20_000;

/** Below this, a new attempt cannot realistically finish: answer right away. */
export const TRANSCRIPTION_MIN_ATTEMPT_MS = 2_000;

/** Time this attempt may use: its own cap, never more than what is left. */
export function attemptTimeout(deadline: number, cap: number, now = Date.now()): number {
  const remaining = deadline - now;
  return remaining < TRANSCRIPTION_MIN_ATTEMPT_MS ? 0 : Math.min(cap, remaining);
}

/** A retry pause is skipped when it would leave no time for the retry itself. */
export function canWaitForRetry(deadline: number, delay: number, now = Date.now()): boolean {
  return deadline - now - delay >= TRANSCRIPTION_MIN_ATTEMPT_MS;
}
