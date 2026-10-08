import { finalTestKey } from "./curriculum";
import { FINAL_TEST_PASS, findLevel, nextLevel } from "./level";

export type PromotionCheck =
  | { ok: true; next: string }
  | {
      ok: false;
      reason: "not_found" | "not_final_test" | "below_pass" | "lessons_missing" | "top_level";
    };

/**
 * Decides whether a stored quiz result promotes the student: it must be their
 * own result, belong to the Final Test of the level they are on now, reach the
 * pass mark (70%) and come with 70% of the level's core lessons finished.
 * Pure so the server rule can be tested directly.
 */
export function checkPromotion(input: {
  userId: string;
  profileLevel: string;
  result: { user_id: string; score: number } | null;
  lessonKey: string | null;
  /** Core lessons of the level finished, and how many are required. */
  coreLessons: { done: number; required: number };
}): PromotionCheck {
  const { result } = input;
  if (!result || result.user_id !== input.userId) return { ok: false, reason: "not_found" };
  if (input.lessonKey !== finalTestKey(input.profileLevel)) {
    return { ok: false, reason: "not_final_test" };
  }
  if (result.score < FINAL_TEST_PASS) return { ok: false, reason: "below_pass" };
  if (input.coreLessons.done < input.coreLessons.required) {
    return { ok: false, reason: "lessons_missing" };
  }
  const next = nextLevel(findLevel(input.profileLevel).value);
  return next ? { ok: true, next: next.value } : { ok: false, reason: "top_level" };
}
