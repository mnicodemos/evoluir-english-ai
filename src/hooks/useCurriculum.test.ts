import { describe, expect, it } from "vitest";

import { getCurriculum } from "@/lib/curriculum";

import { nextPathLesson, reviewUnitsDone } from "./useCurriculum";

describe("reviewUnitsDone", () => {
  it("opens Review I after Units 1 and 2 and Review II after Units 3 to 5", () => {
    const reviews = getCurriculum("b1").filter((lesson) => lesson.reviewUnits.length > 0);
    const [first, second, test] = reviews;
    expect(first?.reviewUnits).toEqual([1, 2]);
    expect(reviewUnitsDone(first!.reviewUnits, new Set([1]))).toBe(false);
    expect(reviewUnitsDone(first!.reviewUnits, new Set([1, 2]))).toBe(true);
    expect(reviewUnitsDone(second!.reviewUnits, new Set([1, 2, 3, 4]))).toBe(false);
    expect(reviewUnitsDone(second!.reviewUnits, new Set([3, 4, 5]))).toBe(true);
    expect(reviewUnitsDone(test!.reviewUnits, new Set([3, 4, 5]))).toBe(false);
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

  it("suggests an open review before the next unit", () => {
    const path = [
      lesson("U2 L6", true),
      lesson("U3 L1", false),
      lesson("Review I", false, [1, 2]),
      lesson("Review II", false, [3, 4, 5], true),
    ];
    expect(nextPathLesson(path)?.title).toBe("Review I");
  });

  it("goes back to the path once the review is done or while it is locked", () => {
    expect(nextPathLesson([lesson("U3 L1", false), lesson("Review I", true, [1, 2])])?.title).toBe(
      "U3 L1",
    );
    expect(
      nextPathLesson([lesson("U1 L2", false), lesson("Review I", false, [1, 2], true)])?.title,
    ).toBe("U1 L2");
    expect(nextPathLesson([lesson("U1 L1", true)])).toBeNull();
  });
});
