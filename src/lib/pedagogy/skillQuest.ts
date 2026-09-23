// Phase 29 — Skill Quest. A PURE, deterministic orchestration layer that turns
// an Invisible Gap (Phase 28) into ONE concrete action using activities that
// already exist. It does not score, does not derive stages, does not call AI,
// does not read or write the database. Learning State stays the authority for
// the stage and Invisible Gaps stay the authority for the gap and its priority.

import type { InvisibleGap, InvisibleGapReason, InvisibleGapType } from "./invisibleGaps";
import { learningStateRank, type LearningState } from "./learningState";
import type { PedagogicalSkill } from "./contracts";

export const SKILL_QUEST_RULE_VERSION = "skill-quest-v1";

/** What the student is asked to do. One per gap nature. */
export type SkillQuestAction =
  | "measure_skill"
  | "add_evidence"
  | "reach_next_stage"
  | "produce_language"
  | "use_spontaneously"
  | "demonstrate_again";

/** An existing surface of the app. Routes are never invented here. */
export type SkillQuestResource = {
  type: "lesson" | "listening" | "writing" | "vocabulary" | "coach" | "teacher";
  title: string;
  to: string;
  params?: { lessonId: string };
  /** Highest capability this surface can actually demonstrate. */
  ceiling: LearningState;
};

export type SkillQuest = {
  skill: PedagogicalSkill;
  /** Gap that originated the quest, kept as reported by Phase 28. */
  gapType: InvisibleGapType;
  reason: InvisibleGapReason;
  /** Stage the Learning State already reports. Never recalculated here. */
  currentState: LearningState;
  /** Capability the student must demonstrate to address the gap. */
  targetState: LearningState;
  action: SkillQuestAction;
  resource: SkillQuestResource;
  /**
   * Phase 31: practising this skill in ANOTHER context is appropriate, because
   * the existing transfer layer (Phase 30) has not seen it used across contexts
   * yet. It is a boolean signal, never a count, a target or a score.
   */
  varyContext?: boolean;
  /** Deterministic order, taken from the gap itself. */
  priority: number;
  ruleVersion: string;
};


const LESSON_CEILING: LearningState = "APPLICATION";

/** Existing surfaces, with the capability each one can really demonstrate. */
const LISTENING: SkillQuestResource = {
  type: "listening",
  title: "Listening Lab",
  to: "/listening",
  ceiling: "RECOGNITION",
};
const VOCABULARY: SkillQuestResource = {
  type: "vocabulary",
  title: "Vocabulary",
  to: "/vocabulary",
  ceiling: "RECOGNITION",
};
const WRITING: SkillQuestResource = {
  type: "writing",
  title: "Writing",
  to: "/writing",
  ceiling: "PRODUCTION",
};
const COACH: SkillQuestResource = {
  type: "coach",
  title: "AI Talking",
  to: "/coach",
  ceiling: "SPONTANEOUS_USE",
};
const TEACHER: SkillQuestResource = {
  type: "teacher",
  title: "AI Teacher",
  to: "/teacher",
  ceiling: "SPONTANEOUS_USE",
};

/**
 * Ordered candidates per skill: the activity most directly related to the skill
 * first, then the conversational surfaces. A skill with no suitable surface for
 * the required capability simply produces no quest.
 */
const RESOURCES_BY_SKILL: Record<PedagogicalSkill, readonly SkillQuestResource[]> = {
  grammar: [WRITING, TEACHER],
  vocabulary: [VOCABULARY, TEACHER],
  reading: [],
  listening: [LISTENING],
  writing: [WRITING, TEACHER],
  speaking: [COACH, TEACHER],
  pronunciation: [COACH],
};

/** Capability the gap requires, and the action that asks for it. */
function requirement(
  gap: InvisibleGap,
): { target: LearningState; action: SkillQuestAction } | null {
  switch (gap.type) {
    case "UNMEASURED":
      return { target: "RECOGNITION", action: "measure_skill" };
    case "INSUFFICIENT_EVIDENCE":
      return { target: "RECOGNITION", action: "add_evidence" };
    case "STAGE_GAP":
      // Only with a deterministic expectation supplied upstream (Phase 28).
      return gap.expectedState
        ? { target: gap.expectedState, action: "reach_next_stage" }
        : null;
    case "PRODUCTION_GAP":
      return { target: "PRODUCTION", action: "produce_language" };
    case "SPONTANEOUS_USE_GAP":
      return { target: "SPONTANEOUS_USE", action: "use_spontaneously" };
    case "MAINTENANCE_GAP":
      // Demonstrating the same stage again later is what proves durability.
      return { target: gap.currentState, action: "demonstrate_again" };
    default:
      return null;
  }
}

export type SkillQuestInput = {
  /** Output of `deriveInvisibleGaps`, in its own priority order. */
  gaps: readonly InvisibleGap[];
  /**
   * One existing, not-completed lesson per skill, exactly as the adaptive next
   * step already resolves it. Optional: without it, lessons are simply not used.
   */
  lessonBySkill?: Record<string, { id: string; title: string } | undefined>;
  /** Phase 31: skills whose transfer the existing layer already demonstrated. */
  transferredSkills?: readonly string[];
};


function lessonResource(
  skill: PedagogicalSkill,
  input: SkillQuestInput,
): SkillQuestResource | null {
  const lesson = input.lessonBySkill?.[skill];
  if (!lesson) return null;
  return {
    type: "lesson",
    title: lesson.title,
    to: "/learning/$lessonId",
    params: { lessonId: lesson.id },
    ceiling: LESSON_CEILING,
  };
}

/**
 * The quest for one gap, or null when no existing surface can demonstrate the
 * required capability. A quest never points at something that does not exist.
 */
export function deriveSkillQuest(
  gap: InvisibleGap,
  input: SkillQuestInput = { gaps: [] },
): SkillQuest | null {
  const need = requirement(gap);
  if (!need) return null;
  const target = learningStateRank(need.target);
  if (target < 0) return null;

  const lesson = lessonResource(gap.skill, input);
  // A lesson is the closest existing content, but only for capabilities it can
  // really demonstrate; production and spontaneous use need a real producer.
  const candidates = [
    ...(lesson && learningStateRank(lesson.ceiling) >= target ? [lesson] : []),
    ...RESOURCES_BY_SKILL[gap.skill],
  ];
  const resource = candidates.find((item) => learningStateRank(item.ceiling) >= target);
  if (!resource) return null;

  return {
    skill: gap.skill,
    gapType: gap.type,
    reason: gap.reason,
    currentState: gap.currentState,
    targetState: need.target,
    action: need.action,
    resource,
    priority: gap.priority,
    ruleVersion: SKILL_QUEST_RULE_VERSION,
  };
}

/**
 * Quests for the given gaps, keeping the existing pedagogical priority order.
 * Pure and idempotent: same input, same output, no side effects.
 */
export function deriveSkillQuests(input: SkillQuestInput): SkillQuest[] {
  return input.gaps
    .map((gap) => deriveSkillQuest(gap, input))
    .filter((quest): quest is SkillQuest => quest !== null);
}

/** The single quest to present: the most urgent executable one, if any. */
export function selectPrioritySkillQuest(input: SkillQuestInput): SkillQuest | null {
  return deriveSkillQuests(input)[0] ?? null;
}

/** Student-facing copy. Factual; no gap type, score or confidence is exposed. */
export const SKILL_QUEST_ACTION_TEXT: Record<SkillQuestAction, string> = {
  measure_skill: "Do a first activity so we can measure this skill",
  add_evidence: "Do one more activity in this skill",
  reach_next_stage: "Take the next step in this skill",
  produce_language: "Produce your own language in this skill",
  use_spontaneously: "Use this skill in a free conversation",
  demonstrate_again: "Show this skill again to keep it solid",
};
