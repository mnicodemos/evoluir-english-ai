import { describe, expect, it } from "vitest";

import { countsAsLearningMinutes, LEARNING_ACTIVITY_TYPES } from "./studyDay";

describe("LEARNING_ACTIVITY_TYPES", () => {
  it("includes only activities that represent a completed learning outcome", () => {
    expect(LEARNING_ACTIVITY_TYPES).toEqual([
      "lesson",
      "final_test",
      "conversation",
      "listening",
      "writing",
      "vocabulary",
      "flashcards",
    ]);
  });

  it("excludes residual timer / navigation practice types", () => {
    const excluded = [
      "lesson_practice",
      "final_test_practice",
      "conversation_practice",
      "listening_practice",
      "writing_practice",
      "vocabulary_reading",
      "telemetry",
      "page_view",
    ];
    for (const type of excluded) {
      expect(countsAsLearningMinutes(type)).toBe(false);
    }
  });

  it("counts every declared learning activity type", () => {
    for (const type of LEARNING_ACTIVITY_TYPES) {
      expect(countsAsLearningMinutes(type)).toBe(true);
    }
  });
});
