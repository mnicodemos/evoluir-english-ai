import { describe, expect, it, vi } from "vitest";

import { finalizeLessonQuiz } from "./quizCompletion";

describe("lesson Quiz completion", () => {
  it("persists a failed 30% result before leaving the lesson incomplete", async () => {
    const order: string[] = [];
    const persistLegacy = vi.fn(async () => {
      order.push("legacy");
    });
    const completeLesson = vi.fn(async () => {
      order.push("complete");
    });

    await expect(finalizeLessonQuiz(30, { persistLegacy, completeLesson })).resolves.toEqual({
      passed: false,
      legacyPersisted: true,
    });
    expect(persistLegacy).toHaveBeenCalledOnce();
    expect(completeLesson).not.toHaveBeenCalled();
    expect(order).toEqual(["legacy"]);
  });

  it("persists an approved result before completing the lesson", async () => {
    const order: string[] = [];
    const result = await finalizeLessonQuiz(70, {
      persistLegacy: async () => {
        order.push("legacy");
      },
      completeLesson: async () => {
        order.push("complete");
      },
    });

    expect(result).toEqual({ passed: true, legacyPersisted: true });
    expect(order).toEqual(["legacy", "complete"]);
  });
});
