import { describe, expect, it } from "vitest";

import { latencyByDay } from "@/lib/aiLatencyTrend";

const row = (operation: string, created_at: string, duration_ms: number, success = true) => ({
  operation,
  created_at,
  success,
  duration_ms,
});

describe("latencyByDay", () => {
  it("groups by São Paulo study day and takes the median of successful calls", () => {
    const trend = latencyByDay([
      row("talking", "2026-10-05T15:00:00Z", 4000),
      row("talking", "2026-10-05T16:00:00Z", 2000),
      row("talking", "2026-10-05T17:00:00Z", 60000, false),
      // 01:00 UTC on the 6th is still the 5th in São Paulo.
      row("talking", "2026-10-06T01:00:00Z", 3000),
      row("talking", "2026-10-06T15:00:00Z", 1000),
    ]);
    expect(trend.days).toEqual(["2026-10-05", "2026-10-06"]);
    expect(trend.operations[0]!.cells["2026-10-05"]).toEqual({ calls: 4, medianMs: 3000 });
    expect(trend.operations[0]!.cells["2026-10-06"]).toEqual({ calls: 1, medianMs: 1000 });
  });

  it("keeps only the most recent days and orders operations by calls", () => {
    const trend = latencyByDay(
      [
        row("dictionary", "2026-10-01T15:00:00Z", 900),
        row("talking", "2026-10-02T15:00:00Z", 900),
        row("talking", "2026-10-03T15:00:00Z", 800),
      ],
      2,
    );
    expect(trend.days).toEqual(["2026-10-02", "2026-10-03"]);
    expect(trend.operations.map((entry) => entry.operation)).toEqual(["talking"]);
  });

  it("reports no time when every call of the day failed", () => {
    const trend = latencyByDay([row("talking", "2026-10-05T15:00:00Z", 20000, false)]);
    expect(trend.operations[0]!.cells["2026-10-05"]).toEqual({ calls: 1, medianMs: null });
  });
});
