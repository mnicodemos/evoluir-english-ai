import { describe, expect, it } from "vitest";

import { getCurriculum } from "@/lib/curriculum";

import { reviewUnitsDone } from "./useCurriculum";

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
