// Turns a SUGGESTED teacher assessment into pedagogical evidence, reusing the
// existing evidence contract. The server decides whether anything is persisted.

import type { MeasuredCefrLevel } from "./cefr";
import type { AssessmentEvidence } from "./contracts";

export const TEACHER_RUBRIC_VERSION = "teacher-interaction-v1";
export const TEACHER_MODEL_VERSION = "gemini-teacher-turn-v1";

/** Only skills a text interaction can actually evidence. */
export const TEACHER_EVIDENCE_SKILLS = ["grammar", "vocabulary", "writing"] as const;

export type TeacherEvidenceSkill = (typeof TEACHER_EVIDENCE_SKILLS)[number];

export type TeacherAssessmentCandidate = {
  assessable: boolean;
  focusSkill: string | null;
  suggestedScore: number | null;
  studentMessage: string;
};

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Server-side gate: an interaction only becomes evidence when the student
 * actually produced enough English AND the suggested skill/score are valid.
 * Questions, greetings and short reactions never generate evidence.
 */
export function teacherEvidenceDecision(
  candidate: TeacherAssessmentCandidate,
):
  { assess: false; reason: string } | { assess: true; skill: TeacherEvidenceSkill; score: number } {
  if (!candidate.assessable) return { assess: false, reason: "not_a_production" };
  const skill = TEACHER_EVIDENCE_SKILLS.find((item) => item === candidate.focusSkill);
  if (!skill) return { assess: false, reason: "invalid_skill" };
  if (
    candidate.suggestedScore === null ||
    !Number.isFinite(candidate.suggestedScore) ||
    candidate.suggestedScore < 0 ||
    candidate.suggestedScore > 100
  ) {
    return { assess: false, reason: "invalid_score" };
  }
  const message = candidate.studentMessage.trim();
  if (wordCount(message) < 4) return { assess: false, reason: "too_short" };
  if (/^[^.!]*\?$/.test(message)) return { assess: false, reason: "question_only" };
  return { assess: true, skill, score: candidate.suggestedScore };
}

/**
 * What kind of task the turn was, decided by the server from the mode/stage it
 * already computed. Guided production is production; an open follow-up the
 * student answers on their own is spontaneous use.
 */
export type TeacherTaskType = "production" | "spontaneous_use";

/**
 * Free conversation is the student using English on their own; every other mode
 * (correction, practice, examples) is a task the teacher set.
 */
export function teacherTaskType(mode: string): TeacherTaskType {
  return mode === "CONVERSATION" ? "spontaneous_use" : "production";
}

export function teacherEvidence(input: {
  skill: TeacherEvidenceSkill;
  score: number;
  turnId: string;
  /** CEFR level of the interaction, resolved server-side from the profile. */
  itemCefr?: MeasuredCefrLevel | null;
  /** Coach sessions reuse this model with their own subskill/rubric label. */
  subskill?: string;
  rubricVersion?: string;
  taskType?: TeacherTaskType;
  /**
   * Real-life context the production happened in (Phase 30). Stored in the
   * existing metadata JSONB only; it changes no score, weight or rubric.
   */
  context?: string | null;
}): AssessmentEvidence[] {
  const subskill = input.subskill ?? "teacher_interaction";
  const context = input.context?.trim();
  return [
    {
      skill: input.skill,
      subskill,
      sourceType: "teacher",
      sourceItemId: input.turnId,
      evidenceType: "subscore",
      polarity: input.score >= 70 ? "positive" : "negative",
      itemCefr: input.itemCefr ?? null,
      rawScore: input.score,
      // A single conversational turn is weaker evidence than a graded quiz or a
      // full writing submission, so it carries less weight in the aggregation.
      sourceReliability: 0.6,
      evidenceQuality: 0.6,
      sampleWeight: 0.5,
      evaluatedBy: "gemini",
      modelVersion: TEACHER_MODEL_VERSION,
      rubricVersion: input.rubricVersion ?? TEACHER_RUBRIC_VERSION,
      metadata: {
        criterion: subskill,
        ...(input.taskType ? { taskType: input.taskType } : {}),
        ...(context ? { context } : {}),
      },
    },
  ];
}

