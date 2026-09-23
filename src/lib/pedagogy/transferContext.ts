// Phase 30 — Transfer Context. A PURE, deterministic read-only reading of
// evidence that ALREADY exists in assessment_evidence: it detects when the SAME
// skill was demonstrated through real production in a DIFFERENT context.
//
// It creates no evidence, no score, no CEFR level, no Confidence and no Learning
// State: it only interprets rows the existing pipeline already persisted. No AI
// decides transfer, no new table, column, route or activity is involved. The
// context itself travels in the metadata JSONB the evidence contract already has.

import {
  pedagogicalSkillSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
} from "./contracts";
import {
  evidenceStage,
  INITIAL_LEARNING_STATE_CONFIG,
  learningStateRank,
  type LearningStateConfig,
} from "./learningState";

export const TRANSFER_CONTEXT_RULE_VERSION = "transfer-context-v1";

export type TransferContextConfig = {
  /** Minimum score for a production result to count as demonstrated. */
  minimumScore: number;
  /** Distinct contexts required before transfer can be reported. */
  minimumContexts: number;
};

export const INITIAL_TRANSFER_CONTEXT_CONFIG: TransferContextConfig = {
  minimumScore: INITIAL_LEARNING_STATE_CONFIG.sustainingScore,
  minimumContexts: 2,
};

/**
 * The context a piece of evidence was produced in, read only from data the
 * evidence already carries: the explicit context/scenario the producer stored in
 * metadata, otherwise the session/activity it belongs to, otherwise the round.
 * Evidence with no identifiable context can never sustain transfer.
 */
export function evidenceContextKey(evidence: AssessmentEvidence): string | null {
  const meta = evidence.metadata ?? {};
  const explicit = meta["context"] ?? meta["scenario"];
  if (typeof explicit === "string" && explicit.trim()) {
    return `context:${explicit.trim().toLowerCase()}`;
  }
  if (evidence.sourceId && evidence.sourceId.trim()) {
    return `source:${evidence.sourceType}:${evidence.sourceId.trim()}`;
  }
  const round = meta["round"];
  if (typeof round === "number" && Number.isFinite(round)) {
    return `round:${evidence.sourceType}:${Math.trunc(round)}`;
  }
  return null;
}

function isValid(evidence: AssessmentEvidence) {
  return (
    pedagogicalSkillSchema.safeParse(evidence.skill).success &&
    Number.isFinite(evidence.rawScore) &&
    evidence.rawScore >= 0 &&
    evidence.rawScore <= 100 &&
    Number.isFinite(evidence.sampleWeight) &&
    evidence.sampleWeight > 0
  );
}

/**
 * Only real production can sustain transfer. The stage comes from the EXISTING
 * Learning State reading, so a quiz item, a listening answer or a recognition
 * task is never contextualised production, however high its score is.
 */
export function isContextualProduction(
  evidence: AssessmentEvidence,
  config: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): boolean {
  if (!isValid(evidence)) return false;
  if (evidence.rawScore < config.minimumScore) return false;
  return learningStateRank(evidenceStage(evidence, stateConfig)) >= learningStateRank("PRODUCTION");
}

export type TransferContextResult = {
  skill: PedagogicalSkill | null;
  /** Same skill demonstrated by valid production in at least two contexts. */
  transferred: boolean;
  /** Distinct contexts, in the order they were first demonstrated. */
  contexts: string[];
  /** Production results considered (valid, in an identifiable context). */
  productionCount: number;
  ruleVersion: string;
};

function time(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Transfer for ONE skill. Pass only evidence of that skill, or use
 * `deriveTransferContexts`. Same skill + same context is never transfer.
 */
export function deriveTransferContext(
  evidence: readonly AssessmentEvidence[],
  config: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): TransferContextResult {
  const skills = new Set(
    evidence
      .filter((item) => pedagogicalSkillSchema.safeParse(item.skill).success)
      .map((i) => i.skill),
  );
  const skill = skills.size === 1 ? ([...skills][0] as PedagogicalSkill) : null;

  const production = evidence
    .filter((item) => isContextualProduction(item, config, stateConfig))
    .map((item) => ({ item, key: evidenceContextKey(item) }))
    .filter((entry): entry is { item: AssessmentEvidence; key: string } => entry.key !== null)
    .sort((a, b) => time(a.item.createdAt) - time(b.item.createdAt));

  const contexts: string[] = [];
  for (const entry of production) {
    if (!contexts.includes(entry.key)) contexts.push(entry.key);
  }

  return {
    skill,
    // Different skills mixed together can never demonstrate one skill's transfer.
    transferred: skill !== null && contexts.length >= config.minimumContexts,
    contexts,
    productionCount: production.length,
    ruleVersion: TRANSFER_CONTEXT_RULE_VERSION,
  };
}

/** Transfer per skill, derived from a mixed evidence list. */
export function deriveTransferContexts(
  evidence: readonly AssessmentEvidence[],
  config: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): Partial<Record<PedagogicalSkill, TransferContextResult>> {
  const bySkill = new Map<PedagogicalSkill, AssessmentEvidence[]>();
  for (const item of evidence) {
    if (!pedagogicalSkillSchema.safeParse(item.skill).success) continue;
    const list = bySkill.get(item.skill) ?? [];
    list.push(item);
    bySkill.set(item.skill, list);
  }
  const result: Partial<Record<PedagogicalSkill, TransferContextResult>> = {};
  for (const [skill, items] of bySkill) {
    result[skill] = { ...deriveTransferContext(items, config, stateConfig), skill };
  }
  return result;
}
