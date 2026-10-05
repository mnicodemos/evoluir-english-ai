import { describe, expect, it } from "vitest";

import {
  MISTAKE_MASTERED_STEP,
  isCorrectAnswer,
  isMistakeDue,
  nextMistakeReview,
} from "./mistakeReview";

describe("isCorrectAnswer", () => {
  it("ignores case, punctuation and curly quotes", () => {
    expect(isCorrectAnswer("I have lived here, since 2020.", "I have lived here since 2020")).toBe(
      true,
    );
    expect(isCorrectAnswer("She doesn’t like it", "she doesn't like it")).toBe(true);
  });

  it("allows one small typo in a longer phrase, never a different phrase", () => {
    expect(isCorrectAnswer("I have been workng here", "I have been working here")).toBe(true);
    expect(isCorrectAnswer("I am working here", "I have been working here")).toBe(false);
    expect(isCorrectAnswer("goed", "went")).toBe(false);
    expect(isCorrectAnswer("", "went")).toBe(false);
  });
});

describe("nextMistakeReview", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("climbs one step with growing intervals", () => {
    expect(nextMistakeReview(0, true, now)).toEqual({
      step: 1,
      nextReviewAt: "2026-10-06T12:00:00.000Z",
    });
    expect(nextMistakeReview(2, true, now).nextReviewAt).toBe("2026-10-12T12:00:00.000Z");
    expect(nextMistakeReview(4, true, now).step).toBe(MISTAKE_MASTERED_STEP);
  });

  it("goes back to the start, due tomorrow, after a wrong answer", () => {
    expect(nextMistakeReview(3, false, now)).toEqual({
      step: 0,
      nextReviewAt: "2026-10-06T12:00:00.000Z",
    });
  });

  it("is due when the date arrived and it is not mastered", () => {
    expect(isMistakeDue({ review_step: 1, next_review_at: "2026-10-05T11:00:00Z" }, now)).toBe(
      true,
    );
    expect(isMistakeDue({ review_step: 1, next_review_at: "2026-10-06T11:00:00Z" }, now)).toBe(
      false,
    );
    expect(isMistakeDue({ review_step: 5, next_review_at: "2026-10-01T00:00:00Z" }, now)).toBe(
      false,
    );
  });
});
