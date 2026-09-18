import { z } from "zod";

import type { WritingFeedback } from "@/lib/ai-prompts";

export const quizAnswerSchema = z
  .object({
    questionId: z.string().uuid(),
    answer: z.string().max(2000),
  })
  .strict();

export const authoritativeQuizInputSchema = z
  .object({
    attemptKey: z.string().uuid(),
    lessonId: z.string().uuid(),
    answers: z.array(quizAnswerSchema).min(1).max(100),
  })
  .strict();

export const authoritativeWritingInputSchema = z
  .object({
    operationKey: z.string().uuid(),
    prompt: z.string().max(2000),
    originalText: z.string().trim().min(1).max(12000),
    level: z.string().min(1).max(40),
  })
  .strict();

type StoredQuestion = {
  id: string;
  question: string;
  correct_answer: string;
  sort_order: number;
};

export type AuthoritativeQuizResult = {
  score: number;
  total: number;
  correct: number;
  details: {
    question_id: string;
    question: string;
    answer: string;
    correct_answer: string;
    is_correct: boolean;
  }[];
};

export function gradeQuizAnswers(
  questions: StoredQuestion[],
  submittedAnswers: { questionId: string; answer: string }[],
): AuthoritativeQuizResult {
  const answers = new Map<string, string>();
  for (const submitted of submittedAnswers) {
    if (answers.has(submitted.questionId)) throw new Error("Duplicate quiz answer");
    answers.set(submitted.questionId, submitted.answer);
  }
  if (questions.length === 0 || answers.size !== questions.length) {
    throw new Error("Every quiz question must have one answer");
  }
  const knownIds = new Set(questions.map((question) => question.id));
  if ([...answers.keys()].some((questionId) => !knownIds.has(questionId))) {
    throw new Error("Quiz answer does not belong to this lesson");
  }
  const details = [...questions]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((question) => {
      const answer = answers.get(question.id);
      if (answer === undefined) throw new Error("Every quiz question must have one answer");
      return {
        question_id: question.id,
        question: question.question,
        answer,
        correct_answer: question.correct_answer,
        is_correct: answer === question.correct_answer,
      };
    });
  const correct = details.filter((detail) => detail.is_correct).length;
  return {
    score: Math.round((correct / details.length) * 100),
    total: details.length,
    correct,
    details,
  };
}

export function writingFeedbackFromRow(row: {
  corrected_text: string;
  natural_text: string;
  explanations: unknown;
  suggestions: unknown;
  grammar_score: number;
  vocabulary_score: number;
  clarity_score: number;
}): WritingFeedback {
  return {
    corrected: row.corrected_text,
    natural: row.natural_text,
    explanations: z.array(z.string()).parse(row.explanations),
    suggestions: z.array(z.string()).parse(row.suggestions),
    grammar: row.grammar_score,
    vocabulary: row.vocabulary_score,
    clarity: row.clarity_score,
  };
}
