import { z } from "zod";

import type { MeasuredCefrLevel } from "./cefr";
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

export type WritingFeedbackSnapshot = WritingSubscores & {
  corrected: string;
  natural: string;
  explanations: string[];
  suggestions: string[];
};

export function writingSubmissionRecord(input: {
  id: string;
  userId: string;
  idempotencyKey: string;
  prompt: string;
  originalText: string;
  feedback: WritingFeedbackSnapshot;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    prompt: input.prompt,
    original_text: input.originalText,
    corrected_text: input.feedback.corrected,
    natural_text: input.feedback.natural,
    explanations: input.feedback.explanations,
    suggestions: input.feedback.suggestions,
    grammar_score: input.feedback.grammar,
    vocabulary_score: input.feedback.vocabulary,
    clarity_score: input.feedback.clarity,
    model_version: PEDAGOGY_MODEL_VERSION,
    rubric_version: WRITING_RUBRIC_VERSION,
  };
}

export function parseQuizDetails(value: unknown): QuizDetail[] {
  const result = z.array(quizDetailSchema).safeParse(value);
  return result.success ? result.data : [];
}

export function quizEvidence(
  detail: ClassifiedQuizDetail,
  itemCefr?: MeasuredCefrLevel | null,
): AssessmentEvidence {
  return {
    skill: pedagogicalSkillSchema.parse(detail.pedagogical_skill),
    sourceType: "quiz",
    sourceItemId: detail.question_id,
    evidenceType: "answer",
    polarity: detail.is_correct ? "positive" : "negative",
    rawScore: detail.is_correct ? 100 : 0,
    // The level of the lesson the question belongs to, so a correct A1 answer is
    // read as A1 evidence instead of level-free mastery.
    itemCefr: itemCefr ?? null,
    sourceReliability: 1,
    evidenceQuality: 0.9,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: QUIZ_RUBRIC_VERSION,
    metadata: { isCorrect: detail.is_correct },
  };
}

export function classifyQuizEvidence(
  details: QuizDetail[],
  skills: ReadonlyMap<string, "grammar" | "vocabulary">,
  itemCefr?: MeasuredCefrLevel | null,
) {
  const evidence: AssessmentEvidence[] = [];
  const missingQuestionIds: string[] = [];
  for (const detail of details) {
    if (!detail.question_id) continue;
    const skill = skills.get(detail.question_id);
    if (skill) {
      evidence.push(
        quizEvidence(
          { ...detail, question_id: detail.question_id, pedagogical_skill: skill },
          itemCefr,
        ),
      );
    } else {
      missingQuestionIds.push(detail.question_id);
    }
  }
  return { evidence, missingQuestionIds };
}

export function writingEvidence(
  scores: WritingSubscores,
  itemCefr?: MeasuredCefrLevel | null,
): AssessmentEvidence[] {
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
    // The task was written for this level and the correction was judged against
    // it (Phase 19), so the evidence carries the same level.
    itemCefr: itemCefr ?? null,
    sourceReliability: 0.8,
    evidenceQuality: 0.85,
    sampleWeight: 1,
    evaluatedBy: "gemini" as const,
    modelVersion: PEDAGOGY_MODEL_VERSION,
    rubricVersion: WRITING_RUBRIC_VERSION,
    metadata: { criterion: item.subskill ?? "unspecified" },
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
