import { describe, expect, test } from "bun:test";

import type { Entitlement, Subscription } from "./contracts";
import { buildSubscriptionView, intervalFromPeriod } from "./subscriptionView";

const NOW = new Date("2026-09-18T00:00:00.000Z");

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: "s1",
    user_id: "u1",
    plan: "premium",
    status: "active",
    provider: "stripe",
    provider_customer_id: "cus_1",
    provider_subscription_id: "sub_1",
    started_at: "2026-09-01T00:00:00.000Z",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2026-10-01T00:00:00.000Z",
    canceled_at: null,
    ...partial,
  };
}

function ent(partial: Partial<Entitlement> = {}): Entitlement {
  return {
    feature: "ai_teacher",
    plan: "premium",
    granted_at: "2026-09-01T00:00:00.000Z",
    expires_at: "2026-10-01T00:00:00.000Z",
    revoked_at: null,
    ...partial,
  };
}

describe("subscription view (Phase 7)", () => {
  test("free user without subscription", () => {
    const view = buildSubscriptionView({ subscriptions: [], entitlements: [] }, NOW);
    expect(view).toMatchObject({
      plan: "free",
      status: null,
      interval: null,
      accessUntil: null,
      canManage: false,
      canceledButActive: false,
    });
  });

  test("active monthly subscription shows premium and monthly interval", () => {
    const view = buildSubscriptionView({ subscriptions: [sub({})], entitlements: [ent()] }, NOW);
    expect(view.plan).toBe("premium");
    expect(view.interval).toBe("monthly");
    expect(view.status).toBe("active");
    expect(view.canManage).toBe(true);
    expect(view.accessUntil).toBe("2026-10-01T00:00:00.000Z");
  });

  test("yearly period is detected", () => {
    expect(
      intervalFromPeriod({
        current_period_start: "2026-09-01T00:00:00.000Z",
        current_period_end: "2027-09-01T00:00:00.000Z",
      }),
    ).toBe("yearly");
  });

  test("canceled subscription with valid entitlement keeps premium", () => {
    const view = buildSubscriptionView(
      {
        subscriptions: [sub({ status: "canceled", canceled_at: "2026-09-10T00:00:00.000Z" })],
        entitlements: [ent()],
      },
      NOW,
    );
    expect(view.plan).toBe("premium");
    expect(view.status).toBe("canceled");
    expect(view.canceledButActive).toBe(true);
  });

  test("expired entitlement falls back to free", () => {
    const view = buildSubscriptionView(
      {
        subscriptions: [sub({ status: "expired", current_period_end: "2026-09-01T00:00:00.000Z" })],
        entitlements: [ent({ expires_at: "2026-09-01T00:00:00.000Z" })],
      },
      NOW,
    );
    expect(view.plan).toBe("free");
    expect(view.status).toBe("expired");
  });

  test("revoked entitlement falls back to free", () => {
    const view = buildSubscriptionView(
      { subscriptions: [sub({})], entitlements: [ent({ revoked_at: NOW.toISOString() })] },
      NOW,
    );
    expect(view.plan).toBe("free");
  });

  test("payment_failed status is surfaced as-is", () => {
    const view = buildSubscriptionView(
      { subscriptions: [sub({ status: "payment_failed" })], entitlements: [] },
      NOW,
    );
    expect(view.plan).toBe("free");
    expect(view.status).toBe("payment_failed");
  });

  test("multiple subscriptions: the granting one describes the state", () => {
    const view = buildSubscriptionView(
      {
        subscriptions: [
          sub({ id: "s1", status: "canceled", current_period_end: "2026-10-01T00:00:00.000Z" }),
          sub({
            id: "s2",
            status: "active",
            current_period_start: "2026-09-01T00:00:00.000Z",
            current_period_end: "2027-09-01T00:00:00.000Z",
          }),
        ],
        entitlements: [ent({ expires_at: "2027-09-01T00:00:00.000Z" })],
      },
      NOW,
    );
    expect(view.plan).toBe("premium");
    expect(view.status).toBe("active");
    expect(view.interval).toBe("yearly");
    expect(view.accessUntil).toBe("2027-09-01T00:00:00.000Z");
  });

  test("subscription without stripe customer cannot be managed", () => {
    const view = buildSubscriptionView(
      { subscriptions: [sub({ provider_customer_id: null })], entitlements: [ent()] },
      NOW,
    );
    expect(view.canManage).toBe(false);
  });
});
