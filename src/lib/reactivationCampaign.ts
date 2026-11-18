export const REACTIVATION_MILESTONES = [2, 4, 7, 14, 30] as const;

export type ReactivationMilestone = (typeof REACTIVATION_MILESTONES)[number];

export interface ReactivationCandidate {
  userId: string;
  lastActivityAt: string;
  inactivityDays: number;
  isPremium: boolean;
}

/** Returns the highest due milestone that has not yet been delivered in this inactivity cycle. */
export function nextReactivationMilestone(
  inactivityDays: number,
  deliveredMilestones: readonly number[],
): ReactivationMilestone | null {
  const delivered = new Set(deliveredMilestones);
  const due = REACTIVATION_MILESTONES.filter(
    (milestone) => inactivityDays >= milestone && !delivered.has(milestone),
  );
  return due[0] ?? null;
}

/** Stable across retries, but changes when the student studies again. */
export function reactivationIdempotencyKey(
  userId: string,
  lastActivityAt: string,
  milestone: ReactivationMilestone,
): string {
  return `reactivation:${userId}:${new Date(lastActivityAt).toISOString()}:${milestone}`;
}

/** Only Free students are eligible; future timestamps and invalid dates are rejected. */
export function isReactivationCandidateEligible(candidate: ReactivationCandidate): boolean {
  const timestamp = Date.parse(candidate.lastActivityAt);
  return (
    !candidate.isPremium &&
    Number.isFinite(timestamp) &&
    timestamp <= Date.now() &&
    candidate.inactivityDays >= 2
  );
}
