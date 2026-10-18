import {
  calibrateCefrToItemLevel,
  cefrForScore,
  cefrRank,
  INITIAL_CEFR_RULESET,
  MEASURED_CEFR_LEVELS,
  measuredCefr,
  type CefrRuleset,
  type MeasuredCefrLevel,
} from "./cefr";
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
  /**
   * Recent work counts more (user decision, 2026-10-17): an answer's weight in
   * the score halves every this many days, so a student who improves sees it.
   * The minimum-evidence checks and the confidence still use the full weights,
   * so old evidence never makes a skill "not measured". null turns it off.
   */
  recencyHalfLifeDays: number | null;
  ruleset: CefrRuleset;
  confidence: ConfidenceConfig;
};

export const INITIAL_SKILL_AGGREGATION_CONFIG: SkillAggregationConfig = {
  minimumEvidenceCount: 2,
  minimumEffectiveWeight: 0.5,
  recencyHalfLifeDays: 30,
  ruleset: INITIAL_CEFR_RULESET,
  confidence: INITIAL_CONFIDENCE_CONFIG,
};

/**
 * Reading is measured only by reading real texts (user decision, 2026-10-17):
 * the daily reading. The Reading evidence that reading lessons' quizzes wrote
 * before is kept in the database but no longer counts; those answers already
 * count for Grammar or Vocabulary, the label of each question.
 */
export function countsForSkill(evidence: Pick<AssessmentEvidence, "skill" | "sourceType">) {
  return !(evidence.skill === "reading" && evidence.sourceType === "quiz");
}

function isValidEvidence(evidence: AssessmentEvidence, skill: PedagogicalSkill) {
  return (
    evidence.skill === skill &&
    countsForSkill(evidence) &&
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

/**
 * The level of the content the evidence actually came from, weighted the same
 * way the score is. Returns null when no evidence carries an item level, which
 * keeps legacy evidence on the previous behaviour.
 */
function practisedLevel(
  weightedEvidence: readonly { itemCefr?: string | null; effectiveWeight: number }[],
): MeasuredCefrLevel | null {
  const levelled = weightedEvidence.flatMap((item) => {
    const level = measuredCefr(item.itemCefr);
    return level && item.effectiveWeight > 0 ? [{ level, weight: item.effectiveWeight }] : [];
  });
  if (levelled.length === 0) return null;
  const totalWeight = levelled.reduce((sum, item) => sum + item.weight, 0);
  const index = Math.round(
    levelled.reduce((sum, item) => sum + cefrRank(item.level) * item.weight, 0) / totalWeight,
  );
  return MEASURED_CEFR_LEVELS[Math.min(Math.max(index, 0), MEASURED_CEFR_LEVELS.length - 1)]!;
}

/** How much an answer counts in the score by its age (1 = new or undated). */
export function recencyFactor(
  createdAt: string | null | undefined,
  halfLifeDays: number | null,
  asOfMs: number,
): number {
  if (!halfLifeDays || !createdAt) return 1;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return 1;
  const ageDays = Math.max(0, (asOfMs - time) / 86_400_000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function aggregateSkillEvidence(
  skill: PedagogicalSkill,
  evidence: readonly AssessmentEvidence[],
  config: SkillAggregationConfig = INITIAL_SKILL_AGGREGATION_CONFIG,
  asOfMs: number = Date.now(),
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

  // The score and the practised level weigh recent answers more.
  const recentEvidence = weightedEvidence.map((item) => ({
    ...item,
    effectiveWeight:
      item.effectiveWeight * recencyFactor(item.createdAt, config.recencyHalfLifeDays, asOfMs),
  }));
  const recentWeight = recentEvidence.reduce((sum, item) => sum + item.effectiveWeight, 0);
  const score = Math.round(
    recentEvidence.reduce((sum, item) => sum + item.rawScore * item.effectiveWeight, 0) /
      recentWeight,
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
    cefr: calibrateCefrToItemLevel(
      cefrForScore(score, config.ruleset),
      practisedLevel(recentEvidence),
    ),
    confidence,
    evidenceCount: validEvidence.length,
    ruleVersion: config.ruleset.version,
  };
}
