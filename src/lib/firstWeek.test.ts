import { describe, expect, it } from "vitest";

import { firstWeekProgress, showFirstWeek, type FirstWeekEvidence } from "./firstWeek";

const none: FirstWeekEvidence = {
  conversations: 0,
  writings: 0,
  lessonsCompleted: 0,
  listenings: 0,
  wordsReviewed: 0,
  mistakesReviewed: 0,
  joinedLeague: false,
};

describe("guided first week", () => {
  it("marks steps from real evidence and points to the first missing one", () => {
    const progress = firstWeekProgress({
      ...none,
      conversations: 1,
      lessonsCompleted: 2,
      wordsReviewed: 9,
    });
    expect(progress.doneCount).toBe(2);
    expect(progress.next?.day).toBe(2);
    expect(progress.steps.find((s) => s.day === 5)?.isDone).toBe(false);
  });

  it("is complete when every step has evidence", () => {
    const progress = firstWeekProgress({
      conversations: 1,
      writings: 1,
      lessonsCompleted: 1,
      listenings: 1,
      wordsReviewed: 10,
      mistakesReviewed: 1,
      joinedLeague: true,
    });
    expect(progress.doneCount).toBe(7);
    expect(progress.next).toBeNull();
  });

  it("shows only for new accounts that have not finished", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(showFirstWeek("2026-10-05T12:00:00Z", 3, now)).toBe(true);
    expect(showFirstWeek("2026-09-20T12:00:00Z", 3, now)).toBe(false);
    expect(showFirstWeek("2026-10-05T12:00:00Z", 7, now)).toBe(false);
    expect(showFirstWeek(null, 0, now)).toBe(false);
  });
});
