import { describe, expect, it } from "vitest";

import { parseCheckoutInput } from "./checkout.functions";
import { PRICE_ENV_BY_INTERVAL, mapStripeStatus, resolvePriceId, secondsToIso } from "./stripeMapping";
import { subscriptionGrantsAccess } from "./contracts";

const env = {
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_monthly_test",
  STRIPE_PRICE_PREMIUM_YEARLY: "price_yearly_test",
};

describe("checkout input", () => {
  it("accepts only the allowed plan intervals", () => {
    expect(parseCheckoutInput({ interval: "monthly" })).toEqual({ interval: "monthly" });
    expect(parseCheckoutInput({ interval: "yearly" })).toEqual({ interval: "yearly" });
  });

  it("rejects arbitrary pricing or premium claims sent by the client", () => {
    expect(() => parseCheckoutInput({ interval: "monthly", price_id: "price_hacked" })).toThrow();
    expect(() => parseCheckoutInput({ interval: "monthly", amount: 1 })).toThrow();
    expect(() => parseCheckoutInput({ interval: "monthly", plan: "premium" })).toThrow();
    expect(() => parseCheckoutInput({ interval: "monthly", isPremium: true })).toThrow();
    expect(() => parseCheckoutInput({ interval: "lifetime" })).toThrow();
    expect(() => parseCheckoutInput({})).toThrow();
  });
});

describe("price resolution", () => {
  it("maps each interval to its own server-side price id", () => {
    expect(resolvePriceId("monthly", env)).toBe("price_monthly_test");
    expect(resolvePriceId("yearly", env)).toBe("price_yearly_test");
    expect(PRICE_ENV_BY_INTERVAL.monthly).not.toBe(PRICE_ENV_BY_INTERVAL.yearly);
  });

  it("fails loudly when a price is not configured", () => {
    expect(() => resolvePriceId("yearly", {})).toThrow(/STRIPE_PRICE_PREMIUM_YEARLY/);
  });
});

describe("status mapping", () => {
  it("maps Stripe statuses onto the Phase 6A contract", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trial");
    expect(mapStripeStatus("past_due")).toBe("payment_failed");
    expect(mapStripeStatus("unpaid")).toBe("payment_failed");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("expired");
  });

  it("never grants access for an unknown Stripe status", () => {
    const status = mapStripeStatus("some_future_status");
    expect(status).toBe("expired");
    expect(subscriptionGrantsAccess({ status, current_period_end: null })).toBe(false);
  });

  it("converts Stripe epoch seconds to ISO timestamps", () => {
    expect(secondsToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(secondsToIso(null)).toBeNull();
    expect(secondsToIso(undefined)).toBeNull();
  });
});
