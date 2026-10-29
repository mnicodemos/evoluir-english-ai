import { describe, expect, it } from "vitest";

import { getCurriculum } from "@/lib/curriculum";

import { nextPathLesson, reviewUnitsDone } from "./useCurriculum";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;

describe("reviewUnitsDone", () => {
  it.each(LEVELS)("%s opens Review I after Units 1 and 2 and Review II after Units 3 to 5", (level) => {
    const reviews = getCurriculum(level).filter((lesson) => lesson.reviewUnits.length > 0);
    const [first, second, test] = reviews;
    expect(first?.reviewUnits).toEqual([1, 2]);
    expect(reviewUnitsDone(first!.reviewUnits, new Set([1]))).toBe(false);
    expect(reviewUnitsDone(first!.reviewUnits, new Set([1, 2]))).toBe(true);
    expect(second?.reviewUnits).toEqual([3, 4, 5]);
    expect(reviewUnitsDone(second!.reviewUnits, new Set([3, 4, 5]))).toBe(true);
    expect(test?.reviewUnits).toEqual([1, 2, 3, 4, 5]);
    expect(reviewUnitsDone(test!.reviewUnits, new Set([1, 2, 3, 4]))).toBe(false);
    expect(reviewUnitsDone(test!.reviewUnits, new Set([1, 2, 3, 4, 5]))).toBe(true);
  });
});

describe("nextPathLesson", () => {
  const lesson = (
    title: string,
    completed: boolean,
    reviewUnits: number[] = [],
    locked = false,
  ) => ({
    title,
    completed,
    locked,
    reviewUnits,
  });

  it.each(LEVELS)("%s follows Unit 1 → Unit 2 → Review I → Units 3–5 → Review II → Review Test", (level) => {
    const curriculum = getCurriculum(level);
    const core = curriculum.filter((item) => item.reviewUnits.length === 0);
    const [reviewOne, reviewTwo, reviewTest] = curriculum.filter((item) => item.reviewUnits.length > 0);

    const afterUnit2 = [
      ...core.map((item) => lesson(item.title, item.unit <= 2)),
      lesson(reviewOne!.title, false, reviewOne!.reviewUnits),
      lesson(reviewTwo!.title, false, reviewTwo!.reviewUnits, true),
      lesson(reviewTest!.title, false, reviewTest!.reviewUnits, true),
    ];
    expect(nextPathLesson(afterUnit2)?.title).toBe(reviewOne!.title);

    const afterReviewOne = [
      ...core.map((item) => lesson(item.title, item.unit <= 2)),
      lesson(reviewOne!.title, true, reviewOne!.reviewUnits),
      ...core.filter((item) => item.unit >= 3).map((item) => lesson(item.title, false)),
      lesson(reviewTwo!.title, false, reviewTwo!.reviewUnits, true),
      lesson(reviewTest!.title, false, reviewTest!.reviewUnits, true),
    ];
    expect(nextPathLesson(afterReviewOne)?.title).toBe(core.find((item) => item.unit === 3)!.title);

    const afterCore = [
      ...core.map((item) => lesson(item.title, true)),
      lesson(reviewOne!.title, true, reviewOne!.reviewUnits),
      lesson(reviewTwo!.title, false, reviewTwo!.reviewUnits),
      lesson(reviewTest!.title, false, reviewTest!.reviewUnits),
    ];
    expect(nextPathLesson(afterCore)?.title).toBe(reviewTwo!.title);

    const afterReviewTwo = [
      ...core.map((item) => lesson(item.title, true)),
      lesson(reviewOne!.title, true, reviewOne!.reviewUnits),
      lesson(reviewTwo!.title, true, reviewTwo!.reviewUnits),
      lesson(reviewTest!.title, false, reviewTest!.reviewUnits),
    ];
    expect(nextPathLesson(afterReviewTwo)?.title).toBe(reviewTest!.title);
  });

  it("goes back to the path while Review I is locked and returns null when done", () => {
    expect(
      nextPathLesson([lesson("U1 L2", false), lesson("Review I", false, [1, 2], true)])?.title,
    ).toBe("U1 L2");
    expect(nextPathLesson([lesson("U1 L1", true)])).toBeNull();
  });
});
