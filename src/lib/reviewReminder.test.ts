import { describe, expect, it } from "vitest";

import {
  countDueReviews,
  shownReviewCount,
  studyReminder,
  wordOfDayBody,
} from "@/lib/reviewReminder";

const now = new Date("2026-10-06T12:00:00Z");

describe("vocabulary review reminder", () => {
  it("counts only due, not fully mastered words, capped at the daily review limit", () => {
    const states = [
      { mastery_level: 20, next_review_at: "2026-10-05T12:00:00Z" },
      { mastery_level: 40, next_review_at: "2026-10-07T12:00:00Z" },
      { mastery_level: 100, next_review_at: "2026-10-01T12:00:00Z" },
      { mastery_level: 0, next_review_at: null },
    ];
    expect(countDueReviews(states, now)).toBe(1);
    expect(shownReviewCount(37)).toBe(10);
  });

  it("adds the reviews to the word of the day only when there are any", () => {
    expect(wordOfDayBody("melhorar — to make better", 0)).toBe("melhorar — to make better");
    expect(wordOfDayBody("melhorar — to make better", 1)).toBe(
      "melhorar — to make better · 🔁 1 palavra para revisar hoje",
    );
  });

  it("points the evening reminder to Vocabulary when reviews are waiting", () => {
    expect(studyReminder(0).path).toBe("/dashboard");
    const withReviews = studyReminder(3);
    expect(withReviews.path).toBe("/vocabulary");
    expect(withReviews.body).toContain("3 palavras para revisar");
  });
});
