import { describe, expect, it } from "vitest";

import { wordReviewTarget } from "./wordReview";

describe("one word review", () => {
  it("adds words and lesson cards into one count", () => {
    expect(wordReviewTarget(4, 3).total).toBe(7);
  });

  it("opens Vocabulary while it has words due", () => {
    expect(wordReviewTarget(2, 5).to).toBe("/vocabulary");
  });

  it("opens the cards' review when only cards are due", () => {
    expect(wordReviewTarget(0, 5)).toEqual({ total: 5, to: "/learning/review" });
  });
});
