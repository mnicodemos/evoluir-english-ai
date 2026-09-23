// Phase 34 — Proof of Progress. A PURE, deterministic reading that answers
// "where did the student REALLY evolve?" from data the system already owns:
//
//   Evidence -> Skill Result -> Current Skill Profile -> Learning State
//   -> Transfer Context (Phase 30) -> loop state (Phase 31)
//
// It creates NO score, NO percentage, NO progress metric, NO evidence, NO CEFR
// and NO parallel history. It performs no I/O and calls no AI: it only compares
// data that already exists and reports observable facts. When there is nothing
// comparable, it says so instead of inventing a "before".

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { PEDAGOGICAL_SKILLS, pedagogicalSkillSchema } from "./contracts";
import { deriveSkillLoopState, type SkillConsolidation } from "./learningLoop";
import {
  deriveLearningState,
  INITIAL_LEARNING_STATE_CONFIG,
  learningStateRank,
  type LearningState,
  type LearningStateConfig,
} from "./learningState";
import { INITIAL_TRANSFER_CONTEXT_CONFIG, type TransferContextConfig } from "./transferContext";

export const PROOF_OF_PROGRESS_RULE_VERSION = "proof-of-progress-v1";

/** Never show a wall of skills: only the most relevant observable evidence. */
export const PROOF_OF_PROGRESS_MAX_HIGHLIGHTS = 5;

/**
 * What kind of observable change sustains this highlight. A LABEL, never a score
 * and never persisted.
 */
export const PROOF_OF_PROGRESS_KINDS = [
  /** The same skill was validly produced in different contexts (Phase 30). */
  "TRANSFER",
  /** The demonstrated stage is higher than it was before (Learning State). */
  "CONSOLIDATION",
  /** Existing skill results improved compared with the previous measurement. */
  "OBSERVABLE_GROWTH",
  /** A barely measured skill now has real evidence. */
  "NEW_EVIDENCE",
] as const;

export type ProofOfProgressKind = (typeof PROOF_OF_PROGRESS_KINDS)[number];

const KIND_PRIORITY: Record<ProofOfProgressKind, number> = {
  TRANSFER: 0,
  CONSOLIDATION: 1,
  OBSERVABLE_GROWTH: 2,
  NEW_EVIDENCE: 3,
};

/** One existing assessment_skill_results row, exactly as already stored. */
export type SkillResultPoint = {
  skill: string;
  score: number | null;
  cefrLevel: string | null;
  assessedAt: string | null;
};

/** One officially recorded level, from existing completed assessment sessions. */
export type LevelHistoryPoint = {
  level: string | null;
  at: string | null;
};

export type ProofOfProgressHighlight = {
  skill: PedagogicalSkill;
  kind: ProofOfProgressKind;
  /** Stage demonstrated by the earlier evidence, or null when none existed. */
  previousState: LearningState | null;
  /** Stage demonstrated now, straight from the existing Learning State layer. */
  currentState: LearningState;
  /** Phase 31 reading, untouched. */
  consolidation: SkillConsolidation;
  /** Phase 30 reading: already demonstrated across contexts. */
  transferred: boolean;
  /** Valid evidence considered, from the existing Learning State reading. */
  evidenceCount: number;
  ruleVersion: string;
};

export type ProofOfProgress = {
  /** The student's real level, from the existing CEFR authority. Never changed. */
  currentLevel: string | null;
  /** Officially recorded level change only. Null when no change was recorded. */
  levelChange: { from: string; to: string } | null;
  /** Observable evidence of evolution, most relevant first. */
  highlights: ProofOfProgressHighlight[];
  /** Guidance only — NOT proof of progress. Skills with no comparable change. */
  keepPractising: PedagogicalSkill[];
  ruleVersion: string;
};

export type ProofOfProgressInput = {
  /** Existing assessment_evidence rows, any skill, exactly as already read. */
  evidence: readonly AssessmentEvidence[];
  /** Existing assessment_skill_results rows (completed sessions). */
  skillHistory?: readonly SkillResultPoint[];
  /** Current CEFR level from the existing profile. */
  currentLevel?: string | null;
  /** Officially recorded levels, from existing completed sessions. */
  levelHistory?: readonly LevelHistoryPoint[];
  /** Defaults to PROOF_OF_PROGRESS_MAX_HIGHLIGHTS. */
  limit?: number;
  skillsToConsider?: readonly PedagogicalSkill[];
};

export type ProofOfProgressConfig = {
  learningState: LearningStateConfig;
  transfer: TransferContextConfig;
};

export const INITIAL_PROOF_OF_PROGRESS_CONFIG: ProofOfProgressConfig = {
  learningState: INITIAL_LEARNING_STATE_CONFIG,
  transfer: INITIAL_TRANSFER_CONTEXT_CONFIG,
};

const VALID_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

function time(value: string | null | undefined): number | null {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function dayKey(value: string | null | undefined): number | null {
  const at = time(value);
  return at === null ? null : Math.floor(at / 86_400_000);
}

/**
 * Evidence from days BEFORE the most recent day of practice. This is the only
 * "before" used, and it is real: when every result comes from a single day there
 * is simply no comparable base, and null is returned instead of a fake baseline.
 */
function previousEvidence(items: readonly AssessmentEvidence[]): AssessmentEvidence[] | null {
  const days = items
    .map((item) => dayKey(item.createdAt))
    .filter((day): day is number => day !== null);
  if (days.length === 0) return null;
  const latestDay = Math.max(...days);
  const earlier = items.filter((item) => {
    const day = dayKey(item.createdAt);
    return day !== null && day < latestDay;
  });
  return earlier.length > 0 ? earlier : null;
}

/**
 * The existing skill results of ONE skill at the student's own level, oldest
 * first. Results from another level do not describe this level, so they are not
 * compared — the same rule the next step and the review already follow.
 */
function resultsAtLevel(
  skill: PedagogicalSkill,
  input: ProofOfProgressInput,
): { score: number; at: number }[] {
  const current = input.currentLevel?.toUpperCase() ?? null;
  return (input.skillHistory ?? [])
    .filter((row) => row.skill === skill)
    .filter((row) => !current || (row.cefrLevel ?? "").toUpperCase() === current)
    .map((row) => ({
      score: row.score === null ? null : Number(row.score),
      at: time(row.assessedAt),
    }))
    .filter((row): row is { score: number; at: number } => row.score !== null && row.at !== null)
    .sort((a, b) => a.at - b.at);
}

/** Officially recorded level change only. Nothing is inferred here. */
export function officialLevelChange(
  history: readonly LevelHistoryPoint[] = [],
): { from: string; to: string } | null {
  const points = history
    .map((row) => ({ level: (row.level ?? "").toUpperCase(), at: time(row.at) }))
    .filter(
      (row): row is { level: string; at: number } => VALID_LEVELS.has(row.level) && row.at !== null,
    )
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return null;
  const from = points[0]!.level;
  const to = points[points.length - 1]!.level;
  return from === to ? null : { from, to };
}

/**
 * The evidence of evolution the student can actually be shown. Pure and
 * idempotent: the same input always produces the same list, in the same order.
 */
export function deriveProofOfProgress(
  input: ProofOfProgressInput,
  config: ProofOfProgressConfig = INITIAL_PROOF_OF_PROGRESS_CONFIG,
): ProofOfProgress {
  const limit = Math.max(0, input.limit ?? PROOF_OF_PROGRESS_MAX_HIGHLIGHTS);
  const valid = input.evidence.filter(
    (item) => pedagogicalSkillSchema.safeParse(item.skill).success,
  );
  const skills = input.skillsToConsider ?? PEDAGOGICAL_SKILLS;

  const highlights: ProofOfProgressHighlight[] = [];
  const keepPractising: PedagogicalSkill[] = [];

  for (const skill of skills) {
    const items = valid.filter((item) => item.skill === skill);
    const results = resultsAtLevel(skill, input);
    // No history at all: nothing happened, so nothing is claimed either way.
    if (items.length === 0 && results.length === 0) continue;

    const loop = deriveSkillLoopState(items, config.learningState, config.transfer);
    const earlier = previousEvidence(items);
    const previousState = earlier ? deriveLearningState(earlier, config.learningState).state : null;
    const currentState = loop.learningState.state;

    const improved =
      results.length >= 2 &&
      results[results.length - 1]!.score > results[results.length - 2]!.score;

    let kind: ProofOfProgressKind | null = null;
    if (loop.transfer.transferred) {
      kind = "TRANSFER";
    } else if (
      previousState !== null &&
      learningStateRank(currentState) > learningStateRank(previousState)
    ) {
      kind = "CONSOLIDATION";
    } else if (improved) {
      kind = "OBSERVABLE_GROWTH";
    } else if (
      (previousState === null || previousState === "INSUFFICIENT_EVIDENCE") &&
      currentState !== "INSUFFICIENT_EVIDENCE" &&
      loop.learningState.evidenceCount >= config.learningState.minimumEvidenceForStage
    ) {
      kind = "NEW_EVIDENCE";
    }

    if (!kind) {
      keepPractising.push(skill);
      continue;
    }

    highlights.push({
      skill,
      kind,
      previousState,
      currentState,
      consolidation: loop.consolidation,
      transferred: loop.transfer.transferred,
      evidenceCount: loop.learningState.evidenceCount,
      ruleVersion: PROOF_OF_PROGRESS_RULE_VERSION,
    });
  }

  highlights.sort(
    (a, b) =>
      KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
      b.evidenceCount - a.evidenceCount ||
      a.skill.localeCompare(b.skill),
  );

  return {
    currentLevel: input.currentLevel ?? null,
    levelChange: officialLevelChange(input.levelHistory ?? []),
    highlights: highlights.slice(0, limit),
    keepPractising: keepPractising.sort((a, b) => a.localeCompare(b)),
    ruleVersion: PROOF_OF_PROGRESS_RULE_VERSION,
  };
}

/**
 * Student-facing copy. Deterministic templates, factual and never quantified:
 * no percentage, no score, no context count, no invented comparison.
 */
export const PROOF_OF_PROGRESS_KIND_TEXT: Record<ProofOfProgressKind, string> = {
  TRANSFER: "You have already used this skill in more than one context.",
  CONSOLIDATION: "You moved from early practice to a higher stage in this skill.",
  OBSERVABLE_GROWTH: "Your results in this skill improved since the previous measurement.",
  NEW_EVIDENCE: "This skill had little evidence before and now has real evidence.",
};

/** Shown when a skill has no comparable base yet. Never framed as evolution. */
export const PROOF_OF_PROGRESS_NO_BASE_TEXT = "We are still gathering evidence for this skill.";
