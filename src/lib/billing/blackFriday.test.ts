import { describe, expect, it } from "vitest";

import {
  blackFridayActive,
  blackFridayPhase,
  blackFridayPush,
  checkoutOffer,
  daysUntilBlackFriday,
  formatBrl,
  offerPriceCents,
} from "./blackFriday";

const during = new Date("2026-11-27T12:00:00Z");
const before = new Date("2026-11-21T02:59:00Z");
const after = new Date("2026-12-01T03:00:00Z");

describe("Black Friday offer", () => {
  it("runs from 21/11 to 30/11 in São Paulo", () => {
    expect(blackFridayActive(before)).toBe(false);
    expect(blackFridayActive(new Date("2026-11-21T03:00:00Z"))).toBe(true);
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

  it("does not activate the offer during warm-up or outside the campaign", () => {
    const warmupStart = new Date("2026-11-03T03:00:00Z");
    const warmupEnd = new Date("2026-11-21T02:59:59Z");
    expect(checkoutOffer("monthly", [], warmupStart)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("monthly", [], warmupEnd)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("yearly", [], during)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("monthly", [], after)).toEqual({ trialDays: 7, couponId: null });
    expect(formatBrl(offerPriceCents("yearly", checkoutOffer("yearly", [], during)))).toBe(
      "R$ 799,90",
    );
  });
});

describe("Black Friday warm-up and pushes", () => {
  it("shows warm-up from 03/11 through 20/11 and the offer from 21/11", () => {
    expect(blackFridayPhase(new Date("2026-11-03T02:59:00Z"))).toBeNull();
    expect(blackFridayPhase(new Date("2026-11-03T03:00:00Z"))).toBe("warmup");
    expect(daysUntilBlackFriday(new Date("2026-11-03T12:00:00Z"))).toBe(18);
    expect(blackFridayPhase(new Date("2026-11-20T23:59:59Z"))).toBe("warmup");
    expect(daysUntilBlackFriday(new Date("2026-11-20T12:00:00Z"))).toBe(1);
    expect(blackFridayPhase(new Date("2026-11-21T02:59:59Z"))).toBe("warmup");
    expect(blackFridayPhase(new Date("2026-11-21T03:00:00Z"))).toBe("live");
    expect(blackFridayPhase(during)).toBe("live");
    expect(blackFridayPhase(after)).toBeNull();
  });

  it("pushes the warm-up announcement and offer launch on their first days", () => {
    expect(blackFridayPush("2026-11-03")?.title).toContain("vem aí");
    expect(blackFridayPush("2026-11-03")?.body).toContain("Esquenta Black Friday");
    expect(blackFridayPush("2026-11-03")?.body).toContain("21/11");
    expect(blackFridayPush("2026-11-20")).toBeNull();
    expect(blackFridayPush("2026-11-21")?.title).toContain("começou");
    expect(blackFridayPush("2026-11-21")?.body).toContain("Até 30/11");
    expect(blackFridayPush("2026-11-30")?.title).toContain("Último dia");
    expect(blackFridayPush("2026-11-25")).toBeNull();
    expect(blackFridayPush("2026-12-01")).toBeNull();
  });
});
