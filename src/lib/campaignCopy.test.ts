import { describe, expect, it } from "vitest";

import { campaignDaysLeft, campaignLastDay, campaignOpen } from "./campaignCopy";

const ENDS = "2026-10-21T03:00:00Z"; // 21/10 00:00 in São Paulo, so 20/10 is the last day

describe("launch campaign by period", () => {
  it("is open while active, with no place limit", () => {
    expect(campaignOpen({ active: true, slots: null, ends_at: ENDS })).toBe(true);
    expect(campaignOpen({ active: false, slots: null, ends_at: ENDS })).toBe(false);
  });

  it("still honours a place limit when there is one", () => {
    expect(campaignOpen({ active: true, slots: 10, slots_left: 0 })).toBe(false);
    expect(campaignOpen({ active: true, slots: 10, slots_left: 3 })).toBe(true);
  });

  it("names 20/10 as the last day", () => {
    expect(campaignLastDay(ENDS)).toBe("20/10");
  });

  it("counts the days left, today included", () => {
    expect(campaignDaysLeft(ENDS, new Date("2026-10-10T12:00:00Z"))).toBe(11);
    expect(campaignDaysLeft(ENDS, new Date("2026-10-20T23:00:00Z"))).toBe(1);
    expect(campaignDaysLeft(ENDS, new Date("2026-10-21T12:00:00Z"))).toBe(0);
  });
});
