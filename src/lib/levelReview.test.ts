import { describe, expect, it } from "vitest";

import { isReviewLevel, leagueLevelOf } from "./level";

describe("reviewing earlier levels", () => {
  it("opens only levels below the highest one reached", () => {
    expect(isReviewLevel("a2", "b2")).toBe(true);
    expect(isReviewLevel("b1", "b2")).toBe(true);
    expect(isReviewLevel("b2", "b2")).toBe(false);
    expect(isReviewLevel("c1", "b2")).toBe(false);
    expect(isReviewLevel("a2", null)).toBe(false);
  });

  it("plays the weekly league at the highest level reached", () => {
    expect(leagueLevelOf({ level: "a2", max_level: "b2" })).toBe("b2");
    expect(leagueLevelOf({ level: "b1", max_level: null })).toBe("b1");
    expect(leagueLevelOf({})).toBeNull();
  });
});
