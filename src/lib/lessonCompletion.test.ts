import { describe, expect, it } from "vitest";

import { lessonCompletionCheck } from "./lessonCompletion";

const lesson = { created_by: "u1", category: "grammar" };

describe("lessonCompletionCheck (only a passed, owned quiz completes a lesson)", () => {
  it("completes a lesson whose own quiz passed", () => {
    expect(
      lessonCompletionCheck({
        userId: "u1",
        result: { user_id: "u1", lesson_id: "l1", score: 70 },
        lesson,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a score below the pass mark", () => {
    expect(
      lessonCompletionCheck({
        userId: "u1",
        result: { user_id: "u1", lesson_id: "l1", score: 69 },
        lesson,
      }),
    ).toEqual({ ok: false, reason: "below_pass" });
  });

  it("refuses another student's result or lesson", () => {
    expect(
      lessonCompletionCheck({
        userId: "u1",
        result: { user_id: "u2", lesson_id: "l1", score: 100 },
        lesson,
      }),
    ).toEqual({ ok: false, reason: "not_owner" });
    expect(
      lessonCompletionCheck({
        userId: "u1",
        result: { user_id: "u1", lesson_id: "l1", score: 100 },
        lesson: { created_by: "u2", category: "grammar" },
      }),
    ).toEqual({ ok: false, reason: "not_owner" });
  });

  it("refuses a missing result or lesson", () => {
    expect(lessonCompletionCheck({ userId: "u1", result: null, lesson })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
