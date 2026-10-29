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

  it("resumes Unit 3 after Review I instead of jumping to a later review", () => {
    const path = [
      lesson("U1 L6", true),
      lesson("U2 L6", true),
      lesson("Review I", true, [1, 2]),
      lesson("U3 L1", false),
      lesson("Review II", false, [3, 4, 5]),
      lesson("Review Test", false, [1, 2, 3, 4, 5]),
    ];
    expect(nextPathLesson(path)?.title).toBe("U3 L1");
  });

  it("suggests Review II only after the core lessons are complete", () => {
    const path = [
      lesson("U1–U5 core lessons", true),
      lesson("Review I", true, [1, 2]),
      lesson("Review II", false, [3, 4, 5]),
      lesson("Review Test", false, [1, 2, 3, 4, 5]),
    ];
    expect(nextPathLesson(path)?.title).toBe("Review II");
  });

  it("goes back to the path while Review I is locked and returns null when done", () => {
    expect(
      nextPathLesson([lesson("U1 L2", false), lesson("Review I", false, [1, 2], true)])?.title,
    ).toBe("U1 L2");
    expect(nextPathLesson([lesson("U1 L1", true)])).toBeNull();
  });
});
