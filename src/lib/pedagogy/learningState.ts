// Phase 27A — Learning State. A PURE, deterministic read-only interpretation of
// evidence that ALREADY exists in assessment_evidence. It is not a score, not a
// CEFR level and not Confidence: nothing here writes, no AI is called, no new
// table or column is used. Opening an activity is never evidence; only a real
// result is, which is already guaranteed upstream by the evidence generators.

import {
  confidenceSchema,
  evaluatorSchema,
  evidenceSourceTypeSchema,
  pedagogicalSkillSchema,
  scoreSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
} from "./contracts";

export const LEARNING_STATES = [
  "EXPOSURE",
  "RECOGNITION",
  "APPLICATION",
  "PRODUCTION",
  "SPONTANEOUS_USE",
  "MAINTENANCE",
] as const;

export type LearningState = (typeof LEARNING_STATES)[number] | "INSUFFICIENT_EVIDENCE";

export const LEARNING_STATE_RULE_VERSION = "learning-state-v1";

export type LearningStateConfig = {
  /** A single isolated result never sustains a stage on its own. */
  minimumEvidenceForStage: number;
  /** Score at or above which a result counts as sustaining its stage. */
  sustainingScore: number;
  /** A conversational result only reads as spontaneous use from this score up. */
  spontaneousScore: number;
  /** Days between two sustaining results before it counts as maintenance. */
  maintenanceIntervalDays: number;
};

export const INITIAL_LEARNING_STATE_CONFIG: LearningStateConfig = {
  minimumEvidenceForStage: 2,
  sustainingScore: 60,
  spontaneousScore: 70,
  maintenanceIntervalDays: 7,
};

export type LearningStateResult = {
  skill: PedagogicalSkill | null;
  state: LearningState;
  /** Distinct, valid evidence considered. */
  evidenceCount: number;
  /** Evidence that actually sustained the reported stage or a higher one. */
  sustainingCount: number;
  ruleVersion: string;
};

const STAGE_RANK: Record<(typeof LEARNING_STATES)[number], number> = {
  EXPOSURE: 0,
  RECOGNITION: 1,
  APPLICATION: 2,
  PRODUCTION: 3,
  SPONTANEOUS_USE: 4,
  MAINTENANCE: 5,
};

export function learningStateRank(state: LearningState): number {
  return state === "INSUFFICIENT_EVIDENCE" ? -1 : STAGE_RANK[state];
}

function isValid(evidence: AssessmentEvidence) {
  return (
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

/** Same result recorded twice (reload, retry of the same round) counts once. */
function dedupeKey(evidence: AssessmentEvidence) {
  return (
    evidence.id ??
    [
      evidence.skill,
      evidence.sourceType,
      evidence.subskill ?? "",
      evidence.sourceId ?? "",
      evidence.sourceItemId ?? "",
      evidence.rubricVersion,
      String(evidence.metadata?.["round"] ?? evidence.metadata?.["item"] ?? ""),
      evidence.createdAt ?? "",
      evidence.rawScore,
    ].join("|")
  );
}

function truthy(value: unknown) {
  return value === true || value === "true";
}

/**
 * The highest stage a single result can possibly demonstrate, by where it came
 * from — never by how high the score is.
 */
export function evidenceStage(
  evidence: AssessmentEvidence,
  config: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): (typeof LEARNING_STATES)[number] {
  const meta = evidence.metadata ?? {};
  switch (evidence.sourceType) {
    case "quiz":
      // Applying a structure only counts when the item itself says so.
      return truthy(meta["application"]) || meta["taskType"] === "application"
        ? "APPLICATION"
        : "RECOGNITION";
    case "listening":
    case "reading":
    case "vocabulary":
    case "placement":
      // Comprehension and recall of given items: recognition, never production.
      return "RECOGNITION";
    case "writing":
      return truthy(meta["freeProduction"]) || meta["taskType"] === "production"
        ? "PRODUCTION"
        : "APPLICATION";
    case "pronunciation":
      // Guaranteed upstream to exist only for a real recorded attempt.
      return "PRODUCTION";
    case "speaking":
    case "teacher":
    case "final_test":
      return evidence.rawScore >= config.spontaneousScore &&
        (evidence.sourceType === "speaking" || evidence.sourceType === "teacher")
        ? "SPONTANEOUS_USE"
        : "PRODUCTION";
    default:
      return "EXPOSURE";
  }
}

function dayKey(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : null;
}

/**
 * Derives the learning state for ONE skill from existing evidence. Pass only
 * evidence of the skill you want, or use `deriveLearningStates`.
 */
export function deriveLearningState(
  evidence: readonly AssessmentEvidence[],
  config: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): LearningStateResult {
  const unique = new Map<string, AssessmentEvidence>();
  for (const item of evidence) {
    if (!isValid(item)) continue;
    const key = dedupeKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  const valid = [...unique.values()];
  const skill = valid[0]?.skill ?? null;

  if (valid.length === 0) {
    return {
      skill,
      state: "INSUFFICIENT_EVIDENCE",
      evidenceCount: 0,
      sustainingCount: 0,
      ruleVersion: LEARNING_STATE_RULE_VERSION,
    };
  }

  // A result only sustains its stage when the student actually performed;
  // a weak attempt still counts as exposure to the content.
  const sustaining = valid
    .filter((item) => item.rawScore >= config.sustainingScore)
    .map((item) => ({ stage: evidenceStage(item, config), evidence: item }));

  let stage: (typeof LEARNING_STATES)[number] = "EXPOSURE";
  let sustainingCount = 0;
  for (const candidate of [...LEARNING_STATES].reverse()) {
    if (candidate === "MAINTENANCE") continue;
    const matching = sustaining.filter(
      (item) => STAGE_RANK[item.stage] >= STAGE_RANK[candidate],
    );
    if (matching.length >= config.minimumEvidenceForStage) {
      stage = candidate;
      sustainingCount = matching.length;
      break;
    }
  }

  let state: LearningState = stage;
  if (STAGE_RANK[stage] >= STAGE_RANK.APPLICATION) {
    // Maintenance = still demonstrated after a real interval, from the
    // timestamps evidence already carries. An immediate repeat does not count.
    const days = sustaining
      .filter((item) => STAGE_RANK[item.stage] >= STAGE_RANK[stage])
      .map((item) => dayKey(item.evidence.createdAt))
      .filter((day): day is number => day !== null);
    if (days.length >= 2) {
      const span = Math.max(...days) - Math.min(...days);
      if (span >= config.maintenanceIntervalDays) state = "MAINTENANCE";
    }
  }

  return {
    skill,
    state,
    evidenceCount: valid.length,
    sustainingCount,
    ruleVersion: LEARNING_STATE_RULE_VERSION,
  };
}

/** Learning state per skill, derived from a mixed evidence list. */
export function deriveLearningStates(
  evidence: readonly AssessmentEvidence[],
  config: LearningStateConfig = INITIAL_LEARNING_STATE_CONFIG,
): Partial<Record<PedagogicalSkill, LearningStateResult>> {
  const bySkill = new Map<PedagogicalSkill, AssessmentEvidence[]>();
  for (const item of evidence) {
    if (!pedagogicalSkillSchema.safeParse(item.skill).success) continue;
    const list = bySkill.get(item.skill) ?? [];
    list.push(item);
    bySkill.set(item.skill, list);
  }
  const result: Partial<Record<PedagogicalSkill, LearningStateResult>> = {};
  for (const [skill, items] of bySkill) {
    result[skill] = { ...deriveLearningState(items, config), skill };
  }
  return result;
}
