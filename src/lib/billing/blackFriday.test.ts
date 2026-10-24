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

  it("gives the monthly plan 30% off and 15 free days, the trial once per account", () => {
    const first = checkoutOffer("monthly", [], during);
    expect(first.trialDays).toBe(15);
    expect(first.couponId).not.toBeNull();
    expect(formatBrl(offerPriceCents("monthly", first))).toBe("R$ 55,93");
    const returning = checkoutOffer("monthly", [{}], during);
    expect(returning.trialDays).toBeNull();
    expect(returning.couponId).not.toBeNull();
  });

  it("leaves the yearly plan and the dates outside the campaign unchanged", () => {
    expect(checkoutOffer("yearly", [], during)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("monthly", [], after)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("monthly", [], before).couponId).toBeNull();
    expect(formatBrl(offerPriceCents("yearly", checkoutOffer("yearly", [], during)))).toBe(
      "R$ 799,90",
    );
  });
});
