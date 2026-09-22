import { z } from "zod";

export const PEDAGOGICAL_SKILLS = [
  "grammar",
  "vocabulary",
  "reading",
  "listening",
  "writing",
  "speaking",
  "pronunciation",
] as const;

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "insufficient_evidence"] as const;

export const ASSESSMENT_TYPES = ["placement", "diagnostic", "progress_check", "final"] as const;
export const ASSESSMENT_STATUSES = ["started", "completed", "abandoned", "invalidated"] as const;

export const EVIDENCE_SOURCE_TYPES = [
  "placement",
  "quiz",
  "writing",
  "speaking",
  "listening",
  "pronunciation",
  "vocabulary",
  "reading",
  "final_test",
  "teacher",
] as const;

export const EVALUATORS = ["deterministic", "gemini", "hybrid"] as const;
export const EVIDENCE_TYPES = ["answer", "subscore"] as const;
export const EVIDENCE_POLARITIES = ["positive", "negative", "neutral"] as const;
export const LEARNING_ERROR_SEVERITIES = ["low", "medium", "high"] as const;

export const pedagogicalSkillSchema = z.enum(PEDAGOGICAL_SKILLS);
export const cefrLevelSchema = z.enum(CEFR_LEVELS);
export const assessmentTypeSchema = z.enum(ASSESSMENT_TYPES);
export const assessmentStatusSchema = z.enum(ASSESSMENT_STATUSES);
export const evidenceSourceTypeSchema = z.enum(EVIDENCE_SOURCE_TYPES);
export const evaluatorSchema = z.enum(EVALUATORS);
export const evidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export const evidencePolaritySchema = z.enum(EVIDENCE_POLARITIES);
export const learningErrorSeveritySchema = z.enum(LEARNING_ERROR_SEVERITIES);
export const scoreSchema = z.number().finite().min(0).max(100);
export const confidenceSchema = z.number().finite().min(0).max(1);

export type PedagogicalSkill = z.infer<typeof pedagogicalSkillSchema>;
export type CefrLevel = z.infer<typeof cefrLevelSchema>;
export type AssessmentType = z.infer<typeof assessmentTypeSchema>;
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;
export type EvaluatedBy = z.infer<typeof evaluatorSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type EvidencePolarity = z.infer<typeof evidencePolaritySchema>;
export type LearningErrorSeverity = z.infer<typeof learningErrorSeveritySchema>;

export type AssessmentEvidence = {
  id?: string;
  skill: PedagogicalSkill;
  subskill?: string | null;
  sourceType: EvidenceSourceType;
  sourceId?: string | null;
  sourceItemId?: string | null;
  evidenceType?: EvidenceType | null;
  polarity?: EvidencePolarity | null;
  itemCefr?: Exclude<CefrLevel, "insufficient_evidence"> | null;
  rawScore: number;
  sourceReliability: number;
  evidenceQuality: number;
  sampleWeight: number;
  evaluatedBy: EvaluatedBy;
  modelVersion?: string | null;
  rubricVersion: string;
  metadata?: Record<string, string | number | boolean | null>;
  /** Existing assessment_evidence.created_at, when the row was read back. */
  createdAt?: string | null;
};

export type SkillAssessmentResult = {
  skill: PedagogicalSkill;
  score: number | null;
  cefr: CefrLevel;
  confidence: number | null;
  evidenceCount: number;
  ruleVersion: string;
};

export type LearningErrorContract = {
  errorType: string;
  category: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  severity: LearningErrorSeverity;
  skill: PedagogicalSkill;
  frequency: number;
  source: string;
  assessmentSessionId?: string | null;
  assessmentEvidenceId?: string | null;
};
