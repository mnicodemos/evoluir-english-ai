import { describe, expect, it } from "vitest";

import { rankingOpen, weekXpRising, weekXpSummary } from "./weekXp";

describe("weekXpSummary", () => {
  it("compares this week with last week and the best earlier week", () => {
    expect(weekXpSummary([{ xp: 120 }, { xp: 80 }, { xp: 200 }])).toEqual({
      thisWeek: 120,
      lastWeek: 80,
      best: 200,
      delta: 40,
      record: false,
    });
  });

  it("marks a new personal best only over earlier weeks with XP", () => {
    expect(weekXpSummary([{ xp: 250 }, { xp: 80 }, { xp: 200 }]).record).toBe(true);
    expect(weekXpSummary([{ xp: 50 }, { xp: 0 }]).record).toBe(false);
    expect(weekXpSummary([{ xp: 50 }]).record).toBe(false);
  });

  it("prefers the live XP of this week when given", () => {
    expect(weekXpSummary([{ xp: 10 }, { xp: 30 }], 45).delta).toBe(15);
    expect(weekXpSummary([]).thisWeek).toBe(0);
  });
});

describe("rankingOpen", () => {
  it("opens the ranking from five students", () => {
    expect(rankingOpen(1)).toBe(false);
    expect(rankingOpen(5)).toBe(true);
  });
});

describe("weekXpRising", () => {
  it("is green with XP at or above last week, the first week included", () => {
    expect(weekXpRising({ thisWeek: 40, delta: 40 })).toBe(true);
    expect(weekXpRising({ thisWeek: 80, delta: 0 })).toBe(true);
    expect(weekXpRising({ thisWeek: 30, delta: -20 })).toBe(false);
    expect(weekXpRising({ thisWeek: 0, delta: 0 })).toBe(false);
  });
});
