// Phase 32 — Smart Review. A PURE, deterministic selection layer that answers
// "which skill is worth recovering now?" from data the system ALREADY owns:
//
//   Evidence -> Learning State -> Transfer Context (Phase 30) -> loop state
//   (Phase 31) + current_skill_profile + recurring errors + recency
//
// It is NOT a spaced-repetition engine. It creates no score, no retention
// metric, no evidence, no CEFR change, no table and no column, performs no I/O
// and calls no AI. It only orders existing signals and points at existing
// surfaces, reusing the Skill Quest resource resolution so both layers agree.

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { PEDAGOGICAL_SKILLS, pedagogicalSkillSchema } from "./contracts";
import {
  deriveSkillLoopStates,
  type SkillConsolidation,
  type SkillLoopState,
} from "./learningLoop";
import {
  INITIAL_LEARNING_STATE_CONFIG,
  learningStateRank,
  type LearningState,
  type LearningStateConfig,
} from "./learningState";
import type { SkillSnapshot } from "./nextStep";
import {
  resolveSkillQuestResource,
  type SkillQuestResource,
} from "./skillQuest";
import { INITIAL_TRANSFER_CONTEXT_CONFIG, type TransferContextConfig } from "./transferContext";

export const SMART_REVIEW_RULE_VERSION = "smart-review-v1";

/**
 * Decision label of a review candidate. A LABEL, never a score and never
 * persisted: it only explains why the skill is worth revisiting now.
 */
export const SMART_REVIEW_CATEGORIES = [
  /** A relevant recent mistake exists for this skill. */
  "ERROR_REVIEW",
  /** The existing confidence index for this skill is low. */
  "LOW_CONFIDENCE_REVIEW",
  /** No valid production demonstrated yet (Phase 31 state A). */
  "UNCONSOLIDATED_REVIEW",
  /** Real production, still in a single context (Phase 31 state B). */
  "CONTEXT_REVIEW",
  /** History exists, relevant time has passed and a real need remains. */
  "DECAY_REVIEW",
] as const;

export type SmartReviewCategory = (typeof SMART_REVIEW_CATEGORIES)[number];

/**
 * Urgency order, kept aligned with the existing pedagogical priority used by
 * `nextStep.ts` and `invisibleGaps.ts` so the layers never disagree. Lower
 * comes first. This is an ordering, not a metric.
 */
const CATEGORY_PRIORITY: Record<SmartReviewCategory, number> = {
  ERROR_REVIEW: 0,
  LOW_CONFIDENCE_REVIEW: 1,
  UNCONSOLIDATED_REVIEW: 2,
  DECAY_REVIEW: 3,
  CONTEXT_REVIEW: 4,
};

/** Same confidence threshold the existing next-step priority already uses. */
const LOW_CONFIDENCE = 0.5;

/**
 * Relative time after which existing practice stops counting as recent. It is
 * the SAME window the adaptive next step already uses for recency; it is not a
 * retention curve and no 1/3/7/14/30-day schedule is implemented here.
 */
const RELEVANT_DAYS = 7;

export type SmartReviewCandidate = {
  skill: PedagogicalSkill;
  category: SmartReviewCategory;
  /** Stage reported by the existing Learning State layer, untouched. */
  currentState: LearningState;
  /** Consolidation reported by the existing Phase 31 layer, untouched. */
  consolidation: SkillConsolidation;
  /** Existing score, only when it belongs to the student's current level. */
  score: number | null;
  /** Internal index only, never displayed. From the existing profile. */
  confidence: number | null;
  /** The student's real level. The review never raises or lowers it. */
  cefrLevel: string | null;
  /** Derived from existing timestamps. Null when none is reliable. */
  daysSinceLastEvidence: number | null;
  /** Existing practice in the recent window. */
  recentlyPractised: boolean;
  /** Phase 31 signal: practising in ANOTHER context is appropriate. */
  varyContext: boolean;
  /** Existing app surface able to host the review, or null when none is. */
  resource: SkillQuestResource | null;
  /** Deterministic order. Lower comes first. */
  priority: number;
  ruleVersion: string;
};

export type SmartReviewInput = {
  /** Existing assessment_evidence rows, any skill, exactly as already read. */
  evidence: readonly AssessmentEvidence[];
  /** current_skill_profile snapshots, as the next step already resolves them. */
  skills?: readonly SkillSnapshot[];
  /** Current CEFR level from the existing profile. */
  currentLevel?: string | null;
  /** learning_profile.common_errors, as already used by the next step. */
  recurringErrors?: readonly string[];
  /** Skills practised in the recent window, from existing activities rows. */
  recentlyPractised?: readonly string[];
  /** One existing, not-completed lesson per skill, already filtered by level. */
  lessonBySkill?: Record<string, { id: string; title: string } | undefined>;
  /** Reference instant, injected so the same input always orders the same way. */
  now?: number;
  /** Skills to consider. Defaults to every pedagogical skill. */
  skillsToConsider?: readonly PedagogicalSkill[];
};

export type SmartReviewConfig = {
  learningState: LearningStateConfig;
  transfer: TransferContextConfig;
};

export const INITIAL_SMART_REVIEW_CONFIG: SmartReviewConfig = {
  learningState: INITIAL_LEARNING_STATE_CONFIG,
  transfer: INITIAL_TRANSFER_CONTEXT_CONFIG,
};

/** Same simple, explainable rule the existing next-step priority uses. */
function skillHasRecentError(skill: string, errors: readonly string[]): boolean {
  return errors.some((error) => error.toLowerCase().includes(skill.toLowerCase()));
}

function time(value: string | null | undefined): number | null {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Days since the most recent RELIABLE timestamp of this skill's evidence. Never
 * invented: historical rows with no usable timestamp simply return null.
 */
function daysSinceLastEvidence(
  evidence: readonly AssessmentEvidence[],
  now: number,
): number | null {
  let latest: number | null = null;
  for (const item of evidence) {
    const at = time(item.createdAt);
    if (at === null) continue;
    if (latest === null || at > latest) latest = at;
  }
  if (latest === null) return null;
  return Math.max(0, Math.floor((now - latest) / 86_400_000));
}

/**
 * Snapshot of this skill AT THE STUDENT'S OWN LEVEL. Mirrors the existing
 * next-step rule: evidence from another level does not describe this level, so
 * its score and confidence are not borrowed. CEFR is never changed here.
 */
function snapshotAtLevel(
  skill: PedagogicalSkill,
  input: SmartReviewInput,
): { score: number | null; confidence: number | null } {
  const currentLevel = input.currentLevel?.toUpperCase() ?? null;
  const found = (input.skills ?? []).find((item) => item.skill === skill);
  if (!found) return { score: null, confidence: null };
  const matchesLevel = !currentLevel || found.cefrLevel.toUpperCase() === currentLevel;
  return matchesLevel
    ? { score: found.score, confidence: found.confidence }
    : { score: null, confidence: null };
}

/**
 * The single category of one skill, or null when it is not worth reviewing now.
 * At most one label per skill: the most urgent one, so the result is actionable.
 */
function category(
  skill: PedagogicalSkill,
  loop: SkillLoopState | undefined,
  facts: {
    score: number | null;
    confidence: number | null;
    days: number | null;
    recentlyPractised: boolean;
    hasError: boolean;
  },
): SmartReviewCategory | null {
  // A recent mistake is worth revisiting even when everything else looks fine.
  if (facts.hasError) return "ERROR_REVIEW";

  // No history at all: measuring a skill for the first time is the next step's
  // job, not a recovery. The review only works over what already happened.
  if (!loop || loop.learningState.evidenceCount === 0) return null;

  if (facts.confidence !== null && facts.confidence < LOW_CONFIDENCE)
    return "LOW_CONFIDENCE_REVIEW";

  if (loop.consolidation === "NOT_CONSOLIDATED") return "UNCONSOLIDATED_REVIEW";

  // Already used across contexts: positive evidence. It is never pushed back to
  // the top just because time passed, and more contexts are never a target.
  if (loop.consolidation === "TRANSFERRED") return null;

  // Production in one context only: a different context is worth practising.
  if (loop.consolidation === "CONTEXTUAL") {
    if (!facts.recentlyPractised || (facts.days !== null && facts.days >= RELEVANT_DAYS))
      return "CONTEXT_REVIEW";
    // Practised right now in its single context: nothing to recover yet.
    return null;
  }

  // Time is only an auxiliary signal, and only where a real need remains.
  if (facts.days !== null && facts.days >= RELEVANT_DAYS && !facts.recentlyPractised)
    return "DECAY_REVIEW";

  return null;
}

/** Capability the review should ask for, given the label. */
function targetState(label: SmartReviewCategory): LearningState {
  return label === "CONTEXT_REVIEW" ? "PRODUCTION" : "RECOGNITION";
}

/**
 * Review candidates, most worth recovering first. Pure and idempotent: the same
 * input always produces the same order (weight, then longer time since the last
 * evidence, then lower score, then skill name).
 */
export function deriveSmartReview(
  input: SmartReviewInput,
  config: SmartReviewConfig = INITIAL_SMART_REVIEW_CONFIG,
): SmartReviewCandidate[] {
  const now = input.now ?? Date.now();
  const errors = input.recurringErrors ?? [];
  const practised = new Set(input.recentlyPractised ?? []);
  const valid = input.evidence.filter(
    (item) => pedagogicalSkillSchema.safeParse(item.skill).success,
  );
  const loopStates = deriveSkillLoopStates(valid, config.learningState, config.transfer);
  const skills = input.skillsToConsider ?? PEDAGOGICAL_SKILLS;

  const candidates: SmartReviewCandidate[] = [];
  for (const skill of skills) {
    const items = valid.filter((item) => item.skill === skill);
    const loop = loopStates[skill];
    const { score, confidence } = snapshotAtLevel(skill, input);
    const days = daysSinceLastEvidence(items, now);
    const recentlyPractised = practised.has(skill);
    const hasError = skillHasRecentError(skill, errors);
    const label = category(skill, loop, { score, confidence, days, recentlyPractised, hasError });
    if (!label) continue;

    const target = targetState(label);
    candidates.push({
      skill,
      category: label,
      currentState: loop?.learningState.state ?? "INSUFFICIENT_EVIDENCE",
      consolidation: loop?.consolidation ?? "NOT_CONSOLIDATED",
      score,
      confidence,
      cefrLevel: input.currentLevel ?? null,
      daysSinceLastEvidence: days,
      recentlyPractised,
      // Phase 31 signal, reused as-is: a transferred skill never gets a forced
      // variation, and the count of contexts is never a goal.
      varyContext: loop?.consolidation === "CONTEXTUAL",
      resource: resolveSkillQuestResource(skill, target, {
        gaps: [],
        lessonBySkill: input.lessonBySkill,
      }),
      priority: CATEGORY_PRIORITY[label],
      ruleVersion: SMART_REVIEW_RULE_VERSION,
    });
  }

  return candidates.sort(
    (a, b) =>
      a.priority - b.priority ||
      (b.daysSinceLastEvidence ?? 0) - (a.daysSinceLastEvidence ?? 0) ||
      (a.score ?? 0) - (b.score ?? 0) ||
      a.skill.localeCompare(b.skill),
  );
}

/**
 * The single review to present: the most worthwhile candidate that an existing
 * surface can actually host. Never points at something that does not exist.
 */
export function selectSmartReview(
  input: SmartReviewInput,
  config: SmartReviewConfig = INITIAL_SMART_REVIEW_CONFIG,
): SmartReviewCandidate | null {
  return deriveSmartReview(input, config).find((item) => item.resource !== null) ?? null;
}

/** Student-facing copy. Factual and never says the student "forgot" anything. */
export const SMART_REVIEW_CATEGORY_TEXT: Record<SmartReviewCategory, string> = {
  ERROR_REVIEW: "Worth reviewing: you made mistakes here recently.",
  LOW_CONFIDENCE_REVIEW: "Worth reviewing: we still have little evidence about this skill.",
  UNCONSOLIDATED_REVIEW: "Worth reviewing: you have not produced this on your own yet.",
  CONTEXT_REVIEW: "Worth reviewing: try this skill in a different situation.",
  DECAY_REVIEW: "Worth reviewing: it has been a while since you practised this.",
};
