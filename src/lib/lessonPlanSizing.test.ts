import { describe, expect, it } from "vitest";

import { getCurriculum } from "@/lib/curriculum";
import {
  CARDS_MAX,
  CARDS_MIN,
  flashcardCount,
  listenCardCount,
  QUIZ_MAX,
  QUIZ_MIN,
  quizQuestionCount,
  REVIEW_TEST_QUESTIONS,
  UNIT_TEST_MAX,
  UNIT_TEST_MIN,
  unitTestQuestionCount,
} from "@/lib/lessonPlanSizing";

const plan = (over: Partial<Parameters<typeof quizQuestionCount>[0]> = {}) => ({
  skill: "listening" as const,
  level: "a1",
  title: "Hearing Greetings",
  objective: "Understand simple greetings.",
  reviewUnits: [] as number[],
  isReviewTest: false,
  ...over,
});

describe("quiz sizing", () => {
  it("stays between 5 and 10 for the whole curriculum", () => {
    for (const level of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
      for (const lesson of getCurriculum(level)) {
        const count = quizQuestionCount(lesson);
        expect(count).toBeGreaterThanOrEqual(QUIZ_MIN);
        expect(count).toBeLessThanOrEqual(QUIZ_MAX);
      }
    }
  });

  it("keeps a simple beginner listening lesson short", () => {
    expect(quizQuestionCount(plan())).toBe(QUIZ_MIN);
  });

  it("asks more of a dense advanced grammar lesson", () => {
    const dense = quizQuestionCount(
      plan({
        skill: "grammar",
        level: "c1",
        objective: "Control reference, ellipsis, discourse markers and cohesion in long texts.",
      }),
    );
    expect(dense).toBeGreaterThan(quizQuestionCount(plan()));
    expect(dense).toBeLessThanOrEqual(QUIZ_MAX);
  });

  it("is not the same amount for every lesson", () => {
    const counts = new Set(getCurriculum("b2").map((lesson) => quizQuestionCount(lesson)));
    expect(counts.size).toBeGreaterThan(1);
  });

  it("keeps the Unit 6 review Test at 10 questions", () => {
    const test = getCurriculum("b1").find((lesson) => lesson.isReviewTest)!;
    expect(quizQuestionCount(test)).toBe(REVIEW_TEST_QUESTIONS);
  });

  it("is deterministic", () => {
    const lesson = getCurriculum("b1")[5]!;
    expect(quizQuestionCount(lesson)).toBe(quizQuestionCount(lesson));
  });
});

describe("flashcard sizing", () => {
  it("stays between 5 and 15 for the whole curriculum", () => {
    for (const level of ["a1", "b1", "c2"]) {
      for (const lesson of getCurriculum(level)) {
        const count = flashcardCount(lesson);
        expect(count).toBeGreaterThanOrEqual(CARDS_MIN);
        expect(count).toBeLessThanOrEqual(CARDS_MAX);
      }
    }
  });

  it("gives a vocabulary lesson more cards than a grammar lesson", () => {
    expect(flashcardCount(plan({ skill: "vocabulary", level: "b2" }))).toBeGreaterThan(
      flashcardCount(plan({ skill: "grammar", level: "b2" })),
    );
  });

  it("does not default to the maximum", () => {
    const counts = getCurriculum("b1").map((lesson) => flashcardCount(lesson));
    expect(counts.filter((count) => count === CARDS_MAX).length).toBeLessThan(counts.length / 2);
  });

  it("keeps listening cards inside the deck", () => {
    expect(listenCardCount(5)).toBe(2);
    expect(listenCardCount(15)).toBe(5);
  });
});

describe("unitTestQuestionCount", () => {
  it("stays between 10 and 20 for every level", () => {
    for (const level of ["a1", "a2", "b1", "b2", "c1", "c2", "weird"]) {
      const total = unitTestQuestionCount(level);
      expect(total).toBeGreaterThanOrEqual(UNIT_TEST_MIN);
      expect(total).toBeLessThanOrEqual(UNIT_TEST_MAX);
    }
  });

  it("asks more of a higher level", () => {
    expect(unitTestQuestionCount("c1")).toBeGreaterThan(unitTestQuestionCount("a1"));
  });
});
