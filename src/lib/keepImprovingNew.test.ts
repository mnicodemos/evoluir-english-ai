import { describe, expect, it } from "vitest";

import { newTodayRows } from "./keepImprovingNew";

const all = { listening: true, writing: true, vocabulary: true };

describe("Keep improving new-today rows", () => {
  it("fills the free rows with today's new activities, reading first", () => {
    const rows = newTodayRows({ readingDone: false, indicators: all, taken: [], slots: 3 });
    expect(rows.map((row) => row.key)).toEqual(["reading", "writing", "vocabulary"]);
  });

  it("leaves out what is done and what another button opens", () => {
    const rows = newTodayRows({
      readingDone: true,
      indicators: { listening: true, writing: false, vocabulary: true },
      taken: ["/vocabulary", "/coach"],
      slots: 3,
    });
    expect(rows.map((row) => row.key)).toEqual(["listening"]);
  });

  it("adds nothing without a free row or while the reading is unknown", () => {
    expect(newTodayRows({ readingDone: false, indicators: all, taken: [], slots: 0 })).toEqual([]);
    const rows = newTodayRows({
      readingDone: undefined,
      indicators: { listening: false, writing: false, vocabulary: false },
      taken: [],
      slots: 2,
    });
    expect(rows).toEqual([]);
  });
});
