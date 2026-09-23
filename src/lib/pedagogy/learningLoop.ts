// Phase 31 — Personal Learning Loop. A PURE, deterministic reading that CONSUMES
// the existing chain instead of extending it:
//
//   Evidence -> Learning State (stage) -> Transfer Context (Phase 30) -> loop state
//
// It creates no score, no confidence, no CEFR, no evidence, no second profile and
// calls no AI. It only answers one question the existing layers already have the
// data for: "is this skill still contextual, or has it been used across contexts?"

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { pedagogicalSkillSchema } from "./contracts";
import {
  deriveLearningState,
  INITIAL_LEARNING_STATE_CONFIG,
  learningStateRank,
  type LearningStateConfig,
  type LearningStateResult,
} from "./learningState";
import {
  deriveTransferContext,
  INITIAL_TRANSFER_CONTEXT_CONFIG,
  type TransferContextConfig,
  type TransferContextResult,
} from "./transferContext";

export const LEARNING_LOOP_RULE_VERSION = "learning-loop-v1";

/**
 * Consolidation reading of one skill. It is NOT a score and NOT a stage: it is a
 * label over the stage and the transfer the existing layers already reported.
 */
export type SkillConsolidation =
  /** State A: no valid production demonstrated yet — keep reinforcing. */
  | "NOT_CONSOLIDATED"
  /** State B: real production, but in a single context so far. */
  | "CONTEXTUAL"
  /** State C: the same skill produced validly in different contexts. */
  | "TRANSFERRED";

export type SkillLoopState = {
  skill: PedagogicalSkill | null;
  /** Reported by the existing Learning State layer, untouched. */
  learningState: LearningStateResult;
  /** Reported by the existing Phase 30 layer, untouched. */
  transfer: TransferContextResult;
  consolidation: SkillConsolidation;
  ruleVersion: string;
};

/**
 * Loop state of ONE skill. Production is whatever the existing Learning State
 * already recognises as production or above, so a multiple-choice item or a
 * recognition activity can never become contextual production here.
 */
export function deriveSkillLoopState(
  evidence: readonly AssessmentEvidence[],
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
  transferConfig: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
): SkillLoopState {
  const learningState = deriveLearningState(evidence, stateConfig);
  const transfer = deriveTransferContext(evidence, transferConfig, stateConfig);
  const produced =
    learningStateRank(learningState.state) >= learningStateRank("PRODUCTION") ||
    transfer.productionCount > 0;
  const consolidation: SkillConsolidation = transfer.transferred
    ? "TRANSFERRED"
    : produced
      ? "CONTEXTUAL"
      : "NOT_CONSOLIDATED";
  return {
    skill: learningState.skill ?? transfer.skill,
    learningState,
    transfer,
    consolidation,
    ruleVersion: LEARNING_LOOP_RULE_VERSION,
  };
}

/** Loop state per skill, from a mixed evidence list. Pure and idempotent. */
export function deriveSkillLoopStates(
  evidence: readonly AssessmentEvidence[],
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
  transferConfig: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
): Partial<Record<PedagogicalSkill, SkillLoopState>> {
  const bySkill = new Map<PedagogicalSkill, AssessmentEvidence[]>();
  for (const item of evidence) {
    if (!pedagogicalSkillSchema.safeParse(item.skill).success) continue;
    const list = bySkill.get(item.skill) ?? [];
    list.push(item);
    bySkill.set(item.skill, list);
  }
  const result: Partial<Record<PedagogicalSkill, SkillLoopState>> = {};
  for (const [skill, items] of bySkill) {
    result[skill] = { ...deriveSkillLoopState(items, stateConfig, transferConfig), skill };
  }
  return result;
}

/**
 * Skills whose transfer is already demonstrated. This is the ONLY signal the
 * loop hands to the existing priority and quest layers: a list, not a metric.
 */
export function transferredSkills(
  evidence: readonly AssessmentEvidence[],
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
  transferConfig: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
): PedagogicalSkill[] {
  const states = deriveSkillLoopStates(evidence, stateConfig, transferConfig);
  return (Object.keys(states) as PedagogicalSkill[])
    .filter((skill) => states[skill]?.consolidation === "TRANSFERRED")
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Skills with real production in a single context: practising them in ANOTHER
 * context is pedagogically appropriate. Also just a list, never a target count.
 */
export function contextualSkills(
  evidence: readonly AssessmentEvidence[],
  stateConfig: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
  transferConfig: TransferContextConfig = INITIAL_TRANSFER_CONTEXT_CONFIG,
): PedagogicalSkill[] {
  const states = deriveSkillLoopStates(evidence, stateConfig, transferConfig);
  return (Object.keys(states) as PedagogicalSkill[])
    .filter((skill) => states[skill]?.consolidation === "CONTEXTUAL")
    .sort((a, b) => a.localeCompare(b));
}
