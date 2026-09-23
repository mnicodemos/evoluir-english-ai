// Learning Journey (Phase 35) — EXPERIENCE layer only.
//
// It creates no pedagogical intelligence: it composes what the existing layers
// already decided server-side (CEFR authority, Proof of Progress, Smart Review,
// Next Step / Skill Quest, Learning State, Transfer Context) into a single,
// readable journey. No new score, no new profile, no persistence, no AI.

import type { NextStep, NextStepActivity } from "./nextStep";
import type { ProofOfProgress } from "./proofOfProgress";
import type { SmartReviewItem } from "./smartReviewUx";

export const LEARNING_JOURNEY_RULE_VERSION = "learning-journey-v1";

/** Never a wall of skills in "Where you are". */
export const LEARNING_JOURNEY_MAX_EVIDENCE_SKILLS = 3;

/** Shown instead of an empty journey. Factual: it promises nothing. */
export const LEARNING_JOURNEY_EMPTY_TEXT =
  "Your journey is starting. Keep practising to gather more evidence.";

/** The existing surface the student is invited to open next. */
export type LearningJourneyMove = {
  /** Skill the move belongs to, when the existing layers named one. */
  skill: string | null;
  /** Existing activity/resource title, never invented. */
  title: string;
  /** Existing app route, taken as-is from the existing layers. */
  to: string;
  params?: { lessonId: string };
};

export type LearningJourney = {
  /** Official CEFR level, straight from the existing authority. Never derived. */
  currentLevel: string | null;
  /** Officially recorded level change only, as reported by Proof of Progress. */
  levelChange: { from: string; to: string } | null;
  /** Skills with relevant evidence, in the engine's own order. Labels only. */
  evidenceSkills: string[];
  /** True when Proof of Progress already has observable evidence to show. */
  hasProofOfProgress: boolean;
  /** Transfer already demonstrated in at least one skill (Phase 30 reading). */
  hasTransfer: boolean;
  /** What deserves attention now: the first existing review recommendation. */
  attention: SmartReviewItem | null;
  /** The next move, resolved by the existing Skill Quest / Next Step. */
  nextMove: LearningJourneyMove | null;
  /** False when there is nothing real to show: the UI then shows the empty text. */
  hasData: boolean;
  ruleVersion: string;
};

export type LearningJourneyInput = {
  /** Output of the existing Proof of Progress reading, or null on partial error. */
  proof?: ProofOfProgress | null;
  /** Output of the existing Next Step reading, or null on partial error. */
  nextStep?: NextStep | null;
  /** Official level from the existing profile, used when proof is unavailable. */
  currentLevel?: string | null;
};

function moveFromActivity(
  skill: string | null,
  activity: NextStepActivity | undefined,
): LearningJourneyMove | null {
  if (!activity?.to) return null;
  return activity.params
    ? { skill, title: activity.title, to: activity.to, params: activity.params }
    : { skill, title: activity.title, to: activity.to };
}

/**
 * Compose the journey. Pure and idempotent: same input, same output.
 * A missing layer (partial error) simply drops its block instead of failing.
 */
export function buildLearningJourney(input: LearningJourneyInput): LearningJourney {
  const proof = input.proof ?? null;
  const step = input.nextStep ?? null;

  const highlights = proof?.highlights ?? [];
  const evidenceSkills: string[] = [];
  for (const highlight of highlights) {
    if (evidenceSkills.length >= LEARNING_JOURNEY_MAX_EVIDENCE_SKILLS) break;
    if (!evidenceSkills.includes(highlight.skill)) evidenceSkills.push(highlight.skill);
  }

  const attention = step?.reviews?.[0] ?? null;

  // The next move reuses the existing resolution: the priority Skill Quest when
  // one exists, otherwise the next step's own activity. Nothing new is resolved.
  const quest = step?.quest ?? null;
  const nextMove = quest?.resource
    ? quest.resource.params
      ? {
          skill: quest.skill,
          title: quest.resource.title,
          to: quest.resource.to,
          params: quest.resource.params,
        }
      : { skill: quest.skill, title: quest.resource.title, to: quest.resource.to }
    : moveFromActivity(step?.prioritySkill ?? null, step?.activity);

  const currentLevel = proof?.currentLevel ?? input.currentLevel ?? null;

  return {
    currentLevel,
    levelChange: proof?.levelChange ?? null,
    evidenceSkills,
    hasProofOfProgress: highlights.length > 0,
    hasTransfer: highlights.some((highlight) => highlight.transferred),
    attention,
    nextMove,
    hasData: Boolean(
      highlights.length > 0 || attention || (nextMove && step?.prioritySkill) || currentLevel,
    ),
    ruleVersion: LEARNING_JOURNEY_RULE_VERSION,
  };
}

/** Student-facing headings. Deterministic templates, translated in the UI. */
export const LEARNING_JOURNEY_TEXT = {
  title: "Your journey",
  subtitle: "Where you are and where you are heading",
  where: "Where you are",
  level: "Your current level",
  evidence: "Skills with relevant evidence",
  transfer: "You have already used a skill in different situations.",
  attention: "What deserves attention now",
  nextMove: "Your next move",
  cta: "Continue",
} as const;
