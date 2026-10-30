import type { WritingMistake } from "@/lib/ai-prompts";

/** A gap in a quiz sentence: three or more underscores, or "(...)". */
const BLANK = /_{3,}|\(\s*\.\.\.\s*\)|\(…\)/;

type GradedQuestion = {
  id: string;
  question: string;
  correct_answer: string;
  explanation: string | null;
  pedagogical_skill: string | null;
};
type GradedDetail = { question_id: string | null; answer: string; is_correct: boolean };

/**
 * The lesson quiz's wrong answers as "My mistakes" (owner request, 2026-10-30:
 * they were lost once the screen closed). Only fill-in sentences become a
 * mistake: the sentence with the student's word against the sentence with the
 * right one, so My mistakes can mark the wrong part. Other questions (choose
 * the meaning, understand a text) have no sentence of the student's to fix.
 */
export function quizMistakes(
  questions: readonly GradedQuestion[],
  details: readonly GradedDetail[],
): WritingMistake[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return details.flatMap((detail) => {
    if (detail.is_correct || !detail.question_id || !detail.answer.trim()) return [];
    const question = byId.get(detail.question_id);
    if (!question || !BLANK.test(question.question)) return [];
    const original = question.question.replace(BLANK, detail.answer.trim());
    const corrected = question.question.replace(BLANK, question.correct_answer.trim());
    if (original === corrected) return [];
    return [
      {
        original,
        corrected,
        explanation: (question.explanation ?? "").trim(),
        category: question.pedagogical_skill === "vocabulary" ? "vocabulary" : "grammar",
      },
    ];
  });
}
