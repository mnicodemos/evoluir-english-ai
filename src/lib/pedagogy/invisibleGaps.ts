// Phase 28 — Invisible Gaps. A PURE, deterministic reading of what the student
// has NOT yet demonstrated. It consumes the existing chain
// (assessment_evidence -> deriveLearningState / aggregateSkillEvidence) and adds
// no second pedagogical architecture: no new score, no new stage scale, no CEFR
// or Confidence change, no AI, no I/O, no table and no column.
//
// An invisible gap is NOT a low score. A weak result is already visible through
// the score and the Adaptive Plan; what is invisible is a capability the
// evidence never demonstrated.

import {
  aggregateSkillEvidence,
  INITIAL_SKILL_AGGREGATION_CONFIG,
  type SkillAggregationConfig,
} from "./aggregateSkill";
import { PEDAGOGICAL_SKILLS, type AssessmentEvidence, type PedagogicalSkill } from "./contracts";
import {
  deriveLearningState,
  INITIAL_LEARNING_STATE_CONFIG,
  learningStateRank,
  type LearningState,
  type LearningStateConfig,
  type LearningStateResult,
} from "./learningState";

export const INVISIBLE_GAP_TYPES = [
  "UNMEASURED",
  "INSUFFICIENT_EVIDENCE",
  "STAGE_GAP",
  "PRODUCTION_GAP",
  "SPONTANEOUS_USE_GAP",
  "MAINTENANCE_GAP",
] as const;

export type InvisibleGapType = (typeof INVISIBLE_GAP_TYPES)[number];

/** Objective, explainable reason. One per gap; nothing inferred from a score. */
export type InvisibleGapReason =
  | "no_valid_evidence"
  | "evidence_below_minimum"
  | "stage_below_expected"
  | "production_not_demonstrated"
  | "spontaneous_use_not_demonstrated"
  | "no_later_evidence_for_maintenance";

export const INVISIBLE_GAP_RULE_VERSION = "invisible-gaps-v1";

export type InvisibleGap = {
  skill: PedagogicalSkill;
  type: InvisibleGapType;
  /** Stage the existing Learning State reports. That layer stays the authority. */
  currentState: LearningState;
  /** Only when a deterministic expectation was supplied by the caller. */
  expectedState: LearningState | null;
  /** Lower comes first. Deterministic, never chosen by AI. */
  priority: number;
  reason: InvisibleGapReason;
  ruleVersion: string;
};

/**
 * Urgency order, kept aligned with the existing pedagogical priority in
 * `nextStep.ts` (recent evidence gaps first, then unmeasured skills, then
 * insufficient evidence), so two layers never disagree.
 */
const TYPE_PRIORITY: Record<InvisibleGapType, number> = {
  UNMEASURED: 0,
  INSUFFICIENT_EVIDENCE: 1,
  STAGE_GAP: 2,
  PRODUCTION_GAP: 3,
  SPONTANEOUS_USE_GAP: 4,
  MAINTENANCE_GAP: 5,
};

/**
 * Highest stage each skill can actually be demonstrated at with the activities
 * that exist today, taken from the real evidence producers: comprehension
 * skills only ever receive recognition evidence (listening, reading, quiz),
 * pronunciation only real recordings, and grammar, vocabulary, writing and
 * speaking can reach spontaneous use through AI Teacher, Coach and AI Talking.
 * A gap is never declared for something the app cannot demonstrate at all.
 */
const SKILL_DEMONSTRABLE_CEILING: Record<PedagogicalSkill, LearningState> = {
  grammar: "SPONTANEOUS_USE",
  vocabulary: "SPONTANEOUS_USE",
  writing: "SPONTANEOUS_USE",
  speaking: "SPONTANEOUS_USE",
  pronunciation: "PRODUCTION",
  listening: "RECOGNITION",
  reading: "RECOGNITION",
};

export type InvisibleGapInput = {
  /** Existing rows, any skill, exactly as the evidence layer already returns. */
  evidence: readonly AssessmentEvidence[];
  /** Skills to consider. Defaults to every pedagogical skill. */
  skills?: readonly PedagogicalSkill[];
  /**
   * Deterministic stage expectation, when the caller already owns one. There is
   * no such source in the system today, so nothing is invented here: without
   * it, STAGE_GAP is simply never reported.
   */
  expectedStateBySkill?: Partial<Record<PedagogicalSkill, LearningState>>;
};

export type InvisibleGapConfig = {
  learningState: LearningStateConfig;
  aggregation: SkillAggregationConfig;
};

export const INITIAL_INVISIBLE_GAP_CONFIG: InvisibleGapConfig = {
  learningState: INITIAL_LEARNING_STATE_CONFIG,
  aggregation: INITIAL_SKILL_AGGREGATION_CONFIG,
};

function gap(
  skill: PedagogicalSkill,
  type: InvisibleGapType,
  currentState: LearningState,
  reason: InvisibleGapReason,
  expectedState: LearningState | null = null,
): InvisibleGap {
  return {
    skill,
    type,
    currentState,
    expectedState,
    priority: TYPE_PRIORITY[type],
    reason,
    ruleVersion: INVISIBLE_GAP_RULE_VERSION,
  };
}

/**
 * The single gap of one skill, if any. At most one is reported per skill: the
 * most urgent one, so the output stays actionable for later phases.
 */
function skillGap(
  skill: PedagogicalSkill,
  state: LearningStateResult,
  /** Existing aggregation result; null score means "not enough to conclude". */
  measured: boolean,
  expectedState: LearningState | undefined,
): InvisibleGap | null {
  // Nothing valid was ever recorded: a measurement gap, not a deficiency.
  if (state.evidenceCount === 0) return gap(skill, "UNMEASURED", state.state, "no_valid_evidence");

  // Some evidence exists, but the existing minimums (count, effective weight,
  // sustaining results) are not met yet. Confidence contributes here through the
  // aggregation rules, and never as a deficiency of knowledge.
  if (!measured || state.state === "INSUFFICIENT_EVIDENCE")
    return gap(skill, "INSUFFICIENT_EVIDENCE", state.state, "evidence_below_minimum");

  const current = learningStateRank(state.state);
  const ceiling = learningStateRank(SKILL_DEMONSTRABLE_CEILING[skill]);

  // Expectation supplied by the caller. Never invented inside this function.
  if (expectedState && current < learningStateRank(expectedState))
    return gap(skill, "STAGE_GAP", state.state, "stage_below_expected", expectedState);

  // Results exist and are sufficient, but the stage is still below what this
  // skill can be demonstrated at. Exposure only (no sustained recognition) is
  // left out on purpose: that is a low score, already visible elsewhere.
  if (current < learningStateRank("RECOGNITION")) return null;

  if (current < learningStateRank("PRODUCTION") && ceiling >= learningStateRank("PRODUCTION"))
    return gap(skill, "PRODUCTION_GAP", state.state, "production_not_demonstrated", "PRODUCTION");

  if (
    current < learningStateRank("SPONTANEOUS_USE") &&
    ceiling >= learningStateRank("SPONTANEOUS_USE")
  )
    return gap(
      skill,
      "SPONTANEOUS_USE_GAP",
      state.state,
      "spontaneous_use_not_demonstrated",
      "SPONTANEOUS_USE",
    );

  // Top stage this skill can show, yet no later evidence on a different day to
  // demonstrate durability. Maintenance keeps being an attribute of the stage
  // (Phase 27B): the stage itself is reported untouched.
  if (!state.maintenance)
    return gap(skill, "MAINTENANCE_GAP", state.state, "no_later_evidence_for_maintenance");

  return null;
}

/**
 * Answers "what has this student not demonstrated enough yet?" from existing
 * evidence only. Pure and idempotent: same input, same output, no side effects.
 * Ordered by deterministic priority, then skill name.
 */
export function deriveInvisibleGaps(
  input: InvisibleGapInput,
  config: InvisibleGapConfig = INITIAL_INVISIBLE_GAP_CONFIG,
): InvisibleGap[] {
  const skills = input.skills ?? PEDAGOGICAL_SKILLS;
  const gaps: InvisibleGap[] = [];
  for (const skill of skills) {
    const items = input.evidence.filter((item) => item.skill === skill);
    const state = deriveLearningState(items, config.learningState);
    // Reuses the existing aggregation, including its minimum count, effective
    // weight and Confidence rules. Nothing here changes score, CEFR or Confidence.
    const measured = aggregateSkillEvidence(skill, items, config.aggregation).score !== null;
    const found = skillGap(skill, state, measured, input.expectedStateBySkill?.[skill]);
    if (found) gaps.push(found);
  }
  return gaps.sort((a, b) => a.priority - b.priority || a.skill.localeCompare(b.skill));
}
