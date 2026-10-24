import { describe, expect, it } from "vitest";

import { blackFridayActive, checkoutOffer, formatBrl, offerPriceCents } from "./blackFriday";

const during = new Date("2026-11-27T12:00:00Z");
const before = new Date("2026-11-23T02:59:00Z");
const after = new Date("2026-12-01T03:00:00Z");

describe("Black Friday offer", () => {
  it("runs from 23/11 to 30/11 in São Paulo", () => {
    expect(blackFridayActive(before)).toBe(false);
    expect(blackFridayActive(new Date("2026-11-23T03:00:00Z"))).toBe(true);
    expect(blackFridayActive(during)).toBe(true);
    expect(blackFridayActive(after)).toBe(false);
  });

  it("gives the monthly plan 15 free days, once per account", () => {
    expect(checkoutOffer("monthly", [], during)).toEqual({ trialDays: 15, couponId: null });
    expect(checkoutOffer("monthly", [{}], during)).toEqual({ trialDays: null, couponId: null });
    expect(checkoutOffer("monthly", [], after)).toEqual({ trialDays: 7, couponId: null });
  });

  it("takes 15% off the yearly plan for everyone, keeping its usual trial", () => {
    const first = checkoutOffer("yearly", [], during);
    expect(first.trialDays).toBe(7);
    expect(first.couponId).not.toBeNull();
    expect(checkoutOffer("yearly", [{}], during).couponId).not.toBeNull();
    expect(checkoutOffer("yearly", [], before).couponId).toBeNull();
    expect(formatBrl(offerPriceCents("yearly", first))).toBe("R$ 679,92");
    expect(formatBrl(offerPriceCents("monthly", checkoutOffer("monthly", [], during)))).toBe(
      "R$ 79,90",
    );
  });
});
