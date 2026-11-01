import { describe, expect, it } from "vitest";

import { dailyGoalTrend } from "./dailyGoalTrend";

describe("dailyGoalTrend", () => {
  const now = new Date(2026, 10, 1, 20, 0); // Sunday evening, local time
  const at = (back: number, hour = 10) => new Date(2026, 10, 1 - back, hour, 0).toISOString();

  it("gives seven days, oldest first, ending today", () => {
    const { days } = dailyGoalTrend([], 15, now);
    expect(days).toHaveLength(7);
    expect(days[6]?.key).toBe("2026-11-01");
    expect(days[0]?.key).toBe("2026-10-26");
  });

  it("sums a day's minutes, caps at 100% and averages every day", () => {
    const rows = [
      { created_at: at(0), duration_minutes: 6 },
      { created_at: at(0, 18), duration_minutes: 3 },
      { created_at: at(1), duration_minutes: 30 },
      { created_at: at(9), duration_minutes: 15 }, // outside the window
    ];
    const { days, average } = dailyGoalTrend(rows, 15, now);
    expect(days[6]).toMatchObject({ minutes: 9, percent: 60 });
    expect(days[5]).toMatchObject({ minutes: 30, percent: 100 });
    expect(average).toBe(Math.round((60 + 100) / 7));
  });

  it("reads 0% without a goal", () => {
    const { days, average } = dailyGoalTrend([{ created_at: at(0), duration_minutes: 20 }], 0, now);
    expect(days[6]?.percent).toBe(0);
    expect(average).toBe(0);
  });
});
