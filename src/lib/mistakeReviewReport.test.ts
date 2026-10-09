import { describe, expect, it } from "vitest";

import { mistakeReviewReport } from "./mistakeReviewReport";

describe("mistakeReviewReport", () => {
  it("measures how many reviewed mistakes were answered right, per source", () => {
    const report = mistakeReviewReport([
      { source: "teacher", review_step: 2, last_reviewed_at: "2026-10-09T10:00:00Z" },
      { source: "teacher", review_step: 0, last_reviewed_at: "2026-10-09T10:00:00Z" },
      { source: "teacher", review_step: 0, last_reviewed_at: null },
      { source: "writing", review_step: 0, last_reviewed_at: null },
    ]);
    expect(report).toEqual([
      { source: "teacher", saved: 3, reviewed: 2, retained: 1, percent: 50 },
      { source: "writing", saved: 1, reviewed: 0, retained: 0, percent: null },
    ]);
  });
});
