import { describe, expect, it } from "vitest";

import { checkPromotion } from "./levelPromotion";

const base = {
  userId: "u1",
  profileLevel: "b1",
  lessonKey: "b1-final",
  coreLessons: { done: 21, required: 21 },
};

describe("checkPromotion", () => {
  it("promotes one level after a passed Final Test of the current level", () => {
    expect(checkPromotion({ ...base, result: { user_id: "u1", score: 70 } })).toEqual({
      ok: true,
      next: "b2",
    });
  });

  it("refuses another student's result, a missing result or a low score", () => {
    expect(checkPromotion({ ...base, result: { user_id: "u2", score: 90 } }).ok).toBe(false);
    expect(checkPromotion({ ...base, result: null }).ok).toBe(false);
    expect(checkPromotion({ ...base, result: { user_id: "u1", score: 69 } })).toEqual({
      ok: false,
      reason: "below_pass",
    });
  });

  it("refuses a normal lesson or another level's Final Test", () => {
    const result = { user_id: "u1", score: 95 };
    expect(checkPromotion({ ...base, result, lessonKey: "b1-u1-l1" }).ok).toBe(false);
    expect(checkPromotion({ ...base, result, lessonKey: "a2-final" }).ok).toBe(false);
  });

  it("does not promote past C2", () => {
    expect(
      checkPromotion({
        userId: "u1",
        profileLevel: "c2",
        lessonKey: "c2-final",
        coreLessons: { done: 30, required: 21 },
        result: { user_id: "u1", score: 100 },
      }),
    ).toEqual({ ok: false, reason: "top_level" });
  });

  it("needs 70% of the core lessons (21 of 30) finished", () => {
    const result = { user_id: "u1", score: 90 };
    expect(checkPromotion({ ...base, result, coreLessons: { done: 20, required: 21 } })).toEqual({
      ok: false,
      reason: "lessons_missing",
    });
    expect(checkPromotion({ ...base, result, coreLessons: { done: 21, required: 21 } }).ok).toBe(
      true,
    );
  });
});
