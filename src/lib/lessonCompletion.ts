import { FINAL_TEST_PASS } from "@/lib/level";
import { LESSON_QUIZ_PASS_SCORE } from "@/lib/quizCompletion";

export type LessonCompletionCheck =
  { ok: true } | { ok: false; reason: "not_found" | "not_owner" | "below_pass" };

/**
 * Whether a stored quiz result completes its lesson (security audit,
 * 2026-10-09): only the server marks a lesson completed, from a result it
 * graded itself, owned by the student, at or above the pass mark.
 */
export function lessonCompletionCheck(input: {
  userId: string;
  result: { user_id: string; lesson_id: string | null; score: number } | null;
  lesson: { created_by: string | null; category: string | null } | null;
}): LessonCompletionCheck {
  const { result, lesson } = input;
  if (!result || !result.lesson_id || !lesson) return { ok: false, reason: "not_found" };
  if (result.user_id !== input.userId || lesson.created_by !== input.userId)
    return { ok: false, reason: "not_owner" };
  const pass = lesson.category === "final-test" ? FINAL_TEST_PASS : LESSON_QUIZ_PASS_SCORE;
  if (result.score < pass) return { ok: false, reason: "below_pass" };
  return { ok: true };
}
