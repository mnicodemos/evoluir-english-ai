import { describe, expect, it } from "vitest";

import { addDays, retentionReport, weekStart } from "./retention";

const today = "2026-10-07"; // a Wednesday

function active(entries: Record<string, string[]>) {
  return new Map(Object.entries(entries).map(([id, days]) => [id, new Set(days)]));
}

describe("weekStart", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-07")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
  });
});

describe("retentionReport", () => {
  it("counts D1 only once the day after signing up is over", () => {
    const report = retentionReport(
      [
        { id: "back", joined: addDays(today, -3) },
        { id: "gone", joined: addDays(today, -3) },
        { id: "new", joined: addDays(today, -1) },
      ],
      active({
        back: [addDays(today, -3), addDays(today, -2)],
        gone: [addDays(today, -3)],
        new: [addDays(today, -1), today],
      }),
      today,
    );
    expect(report.d1).toEqual({ eligible: 2, returned: 1, percent: 50 });
    expect(report.neverReturned).toEqual({ eligible: 2, returned: 1, percent: 50 });
    expect(report.activeToday).toBe(1);
  });

  it("separates the first week from the following week", () => {
    const joined = addDays(today, -20);
    const report = retentionReport(
      [
        { id: "both", joined },
        { id: "first-only", joined },
      ],
      active({
        both: [addDays(joined, 3), addDays(joined, 10)],
        "first-only": [addDays(joined, 5)],
      }),
      today,
    );
    expect(report.week1).toEqual({ eligible: 2, returned: 2, percent: 100 });
    expect(report.week2).toEqual({ eligible: 2, returned: 1, percent: 50 });
    expect(report.d1.percent).toBe(0);
  });

  it("groups recent signups into weekly cohorts, newest first", () => {
    const report = retentionReport(
      [
        { id: "a", joined: "2026-10-06" },
        { id: "b", joined: "2026-09-29" },
        { id: "c", joined: "2026-09-30" },
        { id: "old", joined: "2025-01-10" },
      ],
      active({ b: ["2026-09-30"], old: [today] }),
      today,
    );
    expect(report.cohorts.map((c) => [c.weekStart, c.size])).toEqual([
      ["2026-10-05", 1],
      ["2026-09-28", 2],
    ]);
    expect(report.cohorts[1]?.d1).toEqual({ eligible: 2, returned: 1, percent: 50 });
    // Old students still count as active, outside the cohorts.
    expect(report.students).toBe(4);
    expect(report.active7).toBe(1);
  });

  it("reports no percentage when nobody is old enough yet", () => {
    const report = retentionReport([{ id: "a", joined: today }], new Map(), today);
    expect(report.week2).toEqual({ eligible: 0, returned: 0, percent: null });
  });
});
