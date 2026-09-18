import { z } from "zod";

import { type AssessmentEvidence, pedagogicalSkillSchema } from "./contracts";

export const QUIZ_RUBRIC_VERSION = "quiz-observed-answer-v1";
export const WRITING_RUBRIC_VERSION = "writing-gemini-subscores-v1";
export const PEDAGOGY_MODEL_VERSION = "gemini-writing-feedback-v1";

const quizDetailSchema = z.object({
  question_id: z.string().uuid().optional(),
  question: z.string(),
  answer: z.string(),
  correct_answer: z.string(),
  is_correct: z.boolean(),
});

export type QuizDetail = z.infer<typeof quizDetailSchema>;

export type ClassifiedQuizDetail = QuizDetail & {
  question_id: string;
  pedagogical_skill: "grammar" | "vocabulary";
};

export type WritingSubscores = {
  grammar: number;
  vocabulary: number;
  clarity: number;
};

export function parseQuizDetails(value: unknown): QuizDetail[] {
  const result = z.array(quizDetailSchema).safeParse(value);
  return result.success ? result.data : [];
}

export function quizEvidence(detail: ClassifiedQuizDetail): AssessmentEvidence {
  return {
    skill: pedagogicalSkillSchema.parse(detail.pedagogical_skill),
    sourceType: "quiz",
    sourceItemId: detail.question_id,
    evidenceType: "answer",
    polarity: detail.is_correct ? "positive" : "negative",
    rawScore: detail.is_correct ? 100 : 0,
    sourceReliability: 1,
    evidenceQuality: 0.9,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: QUIZ_RUBRIC_VERSION,
    metadata: { isCorrect: detail.is_correct },
  };
}

export function writingEvidence(scores: WritingSubscores): AssessmentEvidence[] {
  const subscores: Pick<AssessmentEvidence, "skill" | "subskill" | "rawScore">[] = [
    { skill: "grammar", subskill: "writing_grammar", rawScore: scores.grammar },
    { skill: "vocabulary", subskill: "writing_vocabulary", rawScore: scores.vocabulary },
    { skill: "writing", subskill: "clarity", rawScore: scores.clarity },
  ];
  return subscores.map((item) => ({
    ...item,
    sourceType: "writing" as const,
    evidenceType: "subscore" as const,
    polarity: "neutral" as const,
    sourceReliability: 0.8,
    evidenceQuality: 0.85,
    sampleWeight: 1,
    evaluatedBy: "gemini" as const,
    modelVersion: PEDAGOGY_MODEL_VERSION,
    rubricVersion: WRITING_RUBRIC_VERSION,
    metadata: { criterion: item.subskill },
  }));
}

export async function toleratePedagogicalFailure<T>(
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.warn(
      "Pedagogical dual write failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
