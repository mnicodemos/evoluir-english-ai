/**
 * How many quiz questions and flashcards one lesson deserves.
 *
 * The amount is derived deterministically from the lesson plan itself (skill,
 * CEFR level, review scope and how dense the objective is), so no extra AI call
 * is needed and the same lesson always asks for the same amount.
 */

import type { CurriculumLesson } from "@/lib/curriculum";

export const QUIZ_MIN = 5;
export const QUIZ_MAX = 10;
export const CARDS_MIN = 5;
export const CARDS_MAX = 15;

/** The Unit 6 review Test keeps its historical fixed size. */
export const REVIEW_TEST_QUESTIONS = 10;

export type SizingPlan = Pick<
  CurriculumLesson,
  "skill" | "level" | "objective" | "title" | "reviewUnits" | "isReviewTest"
>;

const LEVEL_INDEX: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3, c1: 4, c2: 5 };

/** How many separate concepts a lesson tends to test. */
const QUIZ_SKILL_WEIGHT: Record<string, number> = {
  grammar: 3,
  vocabulary: 2,
  reading: 2,
  writing: 1,
  listening: 1,
  talking: 1,
};

/** How much new lexis a lesson tends to introduce. */
const CARD_SKILL_WEIGHT: Record<string, number> = {
  vocabulary: 5,
  reading: 3,
  listening: 3,
  talking: 2,
  writing: 2,
  grammar: 1,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function levelWeight(level: string) {
  return LEVEL_INDEX[String(level).toLowerCase()] ?? 2;
}

/** Objectives that list several ideas need broader coverage. */
function objectiveDensity(plan: SizingPlan) {
  const text = `${plan.title} ${plan.objective}`;
  const ideas = text.split(/,| and | e |;|\//).filter((part) => part.trim().length > 2).length;
  const words = plan.objective.trim().split(/\s+/).filter(Boolean).length;
  return (ideas >= 3 ? 2 : ideas === 2 ? 1 : 0) + (words >= 14 ? 1 : 0);
}

function reviewWeight(plan: SizingPlan) {
  if (plan.isReviewTest) return 4;
  return plan.reviewUnits.length > 0 ? 2 : 0;
}

/** 5 to 10 questions: simple lessons stay short, dense ones get full coverage. */
export function quizQuestionCount(plan: SizingPlan): number {
  if (plan.isReviewTest) return REVIEW_TEST_QUESTIONS;
  const score =
    (QUIZ_SKILL_WEIGHT[plan.skill] ?? 1) +
    levelWeight(plan.level) +
    objectiveDensity(plan) +
    reviewWeight(plan);
  const count = QUIZ_MIN + Math.floor(score / 2);
  return clamp(count, QUIZ_MIN, QUIZ_MAX);
}

/** 5 to 15 cards, driven mainly by how much new vocabulary the lesson carries. */
export function flashcardCount(plan: SizingPlan): number {
  const score =
    (CARD_SKILL_WEIGHT[plan.skill] ?? 2) * 2 +
    levelWeight(plan.level) +
    objectiveDensity(plan) +
    (plan.reviewUnits.length > 0 ? 2 : 0);
  const count = CARDS_MIN + Math.floor(score / 2);
  return clamp(count, CARDS_MIN, CARDS_MAX);
}

/** Listening cards inside a deck: about a third, never fewer than two. */
export function listenCardCount(total: number): number {
  return clamp(Math.round(total * 0.34), 2, 5);
}

export const UNIT_TEST_MIN = 10;
export const UNIT_TEST_MAX = 20;

/**
 * The unit Final Test integrates the six lessons of the unit: 10 questions at
 * the lowest level, more as the level demands, never above 20.
 */
export function unitTestQuestionCount(level: string): number {
  return clamp(UNIT_TEST_MIN + levelWeight(level), UNIT_TEST_MIN, UNIT_TEST_MAX);
}
