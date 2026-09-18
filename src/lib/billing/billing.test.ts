import { describe, expect, it } from "vitest";

import {
  activeFeatures,
  entitlementIsActive,
  subscriptionGrantsAccess,
  type Entitlement,
} from "./contracts";

const now = new Date("2026-01-10T00:00:00Z");

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    feature: "ai_teacher",
    plan: "premium",
    granted_at: "2026-01-01T00:00:00Z",
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

describe("subscriptionGrantsAccess", () => {
  it("grants access for active and trial inside the period", () => {
    expect(
      subscriptionGrantsAccess({ status: "active", current_period_end: "2026-02-01T00:00:00Z" }, now),
    ).toBe(true);
    expect(subscriptionGrantsAccess({ status: "trial", current_period_end: null }, now)).toBe(true);
  });

  it("denies access for non-granting statuses", () => {
    for (const status of ["canceled", "expired", "payment_failed", "refunded"] as const) {
      expect(subscriptionGrantsAccess({ status, current_period_end: null }, now)).toBe(false);
    }
  });

  it("denies access once the paid period has ended", () => {
    expect(
      subscriptionGrantsAccess({ status: "active", current_period_end: "2026-01-01T00:00:00Z" }, now),
    ).toBe(false);
  });
});

describe("entitlements", () => {
  it("treats revoked and expired entitlements as inactive", () => {
    expect(entitlementIsActive(entitlement({ revoked_at: "2026-01-05T00:00:00Z" }), now)).toBe(false);
    expect(entitlementIsActive(entitlement({ expires_at: "2026-01-05T00:00:00Z" }), now)).toBe(false);
    expect(entitlementIsActive(entitlement({ expires_at: "2026-03-05T00:00:00Z" }), now)).toBe(true);
  });

  it("lists only active features", () => {
    const list = activeFeatures(
      [entitlement(), entitlement({ feature: "ai_talking", revoked_at: "2026-01-02T00:00:00Z" })],
      now,
    );
    expect(list).toEqual(["ai_teacher"]);
  });
});
