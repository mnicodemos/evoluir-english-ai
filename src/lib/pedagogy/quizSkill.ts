import { z } from "zod";

/**
 * Quiz evidence only supports the two skills the dual write already maps
 * (see classifyQuizEvidence). No new taxonomy is introduced here.
 */
export const QUIZ_EVIDENCE_SKILLS = ["grammar", "vocabulary"] as const;

export const quizEvidenceSkillSchema = z.enum(QUIZ_EVIDENCE_SKILLS);

export type QuizEvidenceSkill = z.infer<typeof quizEvidenceSkillSchema>;

/**
 * Server-side resolution of a question's pedagogical skill.
 *
 * `candidate` is the label produced during generation. It is only accepted when
 * it is one of the skills the evidence pipeline already understands. When it is
 * absent or invalid, the structural default is used ONLY when the generation
 * prompt itself constrains the question set to a single skill; otherwise the
 * function returns null so the caller can record an observable failure instead
 * of inventing a classification.
 */
export function resolveQuizEvidenceSkill(
  candidate: unknown,
  structuralDefault?: QuizEvidenceSkill | null,
): QuizEvidenceSkill | null {
  const parsed = quizEvidenceSkillSchema.safeParse(
    typeof candidate === "string" ? candidate.trim().toLowerCase() : candidate,
  );
  if (parsed.success) return parsed.data;
  return structuralDefault ?? null;
}
