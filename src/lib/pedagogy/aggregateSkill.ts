import { cefrForScore, INITIAL_CEFR_RULESET, type CefrRuleset } from "./cefr";
import {
  calculateConfidence,
  type ConfidenceConfig,
  INITIAL_CONFIDENCE_CONFIG,
} from "./confidence";
import {
  confidenceSchema,
  evidenceSourceTypeSchema,
  evaluatorSchema,
  pedagogicalSkillSchema,
  scoreSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
  type SkillAssessmentResult,
} from "./contracts";

export type SkillAggregationConfig = {
  minimumEvidenceCount: number;
  minimumEffectiveWeight: number;
  ruleset: CefrRuleset;
  confidence: ConfidenceConfig;
};

export const INITIAL_SKILL_AGGREGATION_CONFIG: SkillAggregationConfig = {
  minimumEvidenceCount: 2,
  minimumEffectiveWeight: 0.5,
  ruleset: INITIAL_CEFR_RULESET,
  confidence: INITIAL_CONFIDENCE_CONFIG,
};

function isValidEvidence(evidence: AssessmentEvidence, skill: PedagogicalSkill) {
  return (
    evidence.skill === skill &&
    pedagogicalSkillSchema.safeParse(evidence.skill).success &&
    evidenceSourceTypeSchema.safeParse(evidence.sourceType).success &&
    evaluatorSchema.safeParse(evidence.evaluatedBy).success &&
    scoreSchema.safeParse(evidence.rawScore).success &&
    confidenceSchema.safeParse(evidence.sourceReliability).success &&
    confidenceSchema.safeParse(evidence.evidenceQuality).success &&
    Number.isFinite(evidence.sampleWeight) &&
    evidence.sampleWeight > 0
  );
}

export function aggregateSkillEvidence(
  skill: PedagogicalSkill,
  evidence: readonly AssessmentEvidence[],
  config: SkillAggregationConfig = INITIAL_SKILL_AGGREGATION_CONFIG,
): SkillAssessmentResult {
  const validSkill = pedagogicalSkillSchema.parse(skill);
  const validEvidence = evidence.filter((item) => isValidEvidence(item, validSkill));
  const weightedEvidence = validEvidence.map((item) => ({
    ...item,
    effectiveWeight: item.sampleWeight * item.evidenceQuality * item.sourceReliability,
  }));
  const totalEffectiveWeight = weightedEvidence.reduce(
    (sum, item) => sum + item.effectiveWeight,
    0,
  );

  if (
    validEvidence.length < config.minimumEvidenceCount ||
    totalEffectiveWeight < config.minimumEffectiveWeight
  ) {
    return {
      skill: validSkill,
      score: null,
      cefr: "insufficient_evidence",
      confidence: null,
      evidenceCount: validEvidence.length,
      ruleVersion: config.ruleset.version,
    };
  }

  const score = Math.round(
    weightedEvidence.reduce((sum, item) => sum + item.rawScore * item.effectiveWeight, 0) /
      totalEffectiveWeight,
  );
  const confidence = calculateConfidence(
    validEvidence.map((item) => ({
      score: item.rawScore,
      evidenceQuality: item.evidenceQuality,
      sourceReliability: item.sourceReliability,
      sampleWeight: item.sampleWeight,
    })),
    score,
    config.confidence,
  );

  return {
    skill: validSkill,
    score,
    cefr: cefrForScore(score, config.ruleset),
    confidence,
    evidenceCount: validEvidence.length,
    ruleVersion: config.ruleset.version,
  };
}
