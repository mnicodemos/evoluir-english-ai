import { describe, expect, it } from "vitest";

import {
  isReactivationCandidateEligible,
  nextReactivationMilestone,
  reactivationIdempotencyKey,
} from "./reactivationCampaign";

describe("reactivationCampaign", () => {
  it("returns only the next due milestone", () => {
    expect(nextReactivationMilestone(10, [])).toBe(2);
    expect(nextReactivationMilestone(10, [2, 4, 7])).toBeNull();
    expect(nextReactivationMilestone(30, [2, 4, 7, 14])).toBe(30);
  });

  it("uses the activity timestamp to distinguish reactivation cycles", () => {
    expect(reactivationIdempotencyKey("user-1", "2026-11-01T10:00:00Z", 2)).not.toBe(
      reactivationIdempotencyKey("user-1", "2026-11-03T10:00:00Z", 2),
    );
  });

  it("excludes Premium users and invalid or future activity dates", () => {
    expect(
      isReactivationCandidateEligible({
        userId: "user-1",
        lastActivityAt: "2020-01-01T00:00:00Z",
        inactivityDays: 2,
        isPremium: true,
      }),
    ).toBe(false);
    expect(
      isReactivationCandidateEligible({
        userId: "user-1",
        lastActivityAt: "not-a-date",
        inactivityDays: 10,
        isPremium: false,
      }),
    ).toBe(false);
  });
});
