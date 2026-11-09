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
const before = new Date("2026-11-03T02:59:00Z");
const after = new Date("2026-12-01T03:00:00Z");

describe("Black Friday offer", () => {
  it("runs from 03/11 to 30/11 in São Paulo", () => {
    expect(blackFridayActive(before)).toBe(false);
    expect(blackFridayActive(new Date("2026-11-03T03:00:00Z"))).toBe(true);
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

  it("keeps the live offer active through 30/11 and leaves annual/out-of-campaign pricing unchanged", () => {
    const campaignStart = new Date("2026-11-03T03:00:00Z");
    const campaignLastMoment = new Date("2026-12-01T02:59:59Z");
    expect(checkoutOffer("monthly", [], campaignStart)).toEqual({
      trialDays: 15,
      couponId: "EVOLUIR_BF2026_MONTHLY30X3",
    });
    expect(checkoutOffer("monthly", [], campaignLastMoment)).toEqual({
      trialDays: 15,
      couponId: "EVOLUIR_BF2026_MONTHLY30X3",
    });
    expect(checkoutOffer("yearly", [], during)).toEqual({ trialDays: 7, couponId: null });
    expect(checkoutOffer("monthly", [], after)).toEqual({ trialDays: 7, couponId: null });
    expect(formatBrl(offerPriceCents("yearly", checkoutOffer("yearly", [], during)))).toBe(
      "R$ 799,90",
    );
  });
});

describe("Black Friday campaign and pushes", () => {
  it("shows the live offer from 03/11 through 30/11 with no warm-up phase", () => {
    expect(blackFridayPhase(new Date("2026-11-03T02:59:00Z"))).toBeNull();
    expect(blackFridayPhase(new Date("2026-11-03T03:00:00Z"))).toBe("live");
    expect(daysUntilBlackFriday(new Date("2026-11-03T12:00:00Z"))).toBe(0);
    expect(blackFridayPhase(new Date("2026-11-20T23:59:59Z"))).toBe("live");
    expect(daysUntilBlackFriday(new Date("2026-11-20T12:00:00Z"))).toBe(0);
    expect(blackFridayPhase(new Date("2026-11-21T02:59:59Z"))).toBe("live");
    expect(blackFridayPhase(new Date("2026-11-21T03:00:00Z"))).toBe("live");
    expect(blackFridayPhase(during)).toBe("live");
    expect(blackFridayPhase(after)).toBeNull();
  });

  it("announces the live offer on 03/11 and the last day on 30/11", () => {
    expect(blackFridayPush("2026-11-03")?.title).toContain("começou");
    expect(blackFridayPush("2026-11-03")?.body).toContain("30% off");

    expect(blackFridayPush("2026-11-20")).toBeNull();
    expect(blackFridayPush("2026-11-21")).toBeNull();
    expect(blackFridayPush("2026-11-03")?.body).toContain("Até 30/11");
    expect(blackFridayPush("2026-11-30")?.title).toContain("Último dia");
    expect(blackFridayPush("2026-11-25")).toBeNull();
    expect(blackFridayPush("2026-12-01")).toBeNull();
  });
});
