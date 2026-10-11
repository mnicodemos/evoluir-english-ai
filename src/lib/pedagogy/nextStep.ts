// Deterministic "next step" layer (Phase 10).
// Pure functions over data the server already owns (current_skill_profile,
// learning_profile.common_errors, activities recency, lessons). No LLM, no new
// profile, no new score, no new CEFR, no new evidence.

import type { SkillQuest } from "./skillQuest";
import type { SmartReviewItem } from "./smartReviewUx";

export type SkillSnapshot = {
  skill: string;
  score: number | null;
  confidence: number | null;
  cefrLevel: string;
};

export type NextStepReason =
  | "recent_errors"
  | "low_confidence"
  | "lowest_score"
  | "not_practised_recently"
  | "not_measured_yet"
  | "no_data";

export type NextStepAction =
  | "review_lesson"
  | "practise_listening"
  | "practise_writing"
  | "practise_speaking"
  | "practise_vocabulary"
  | "talk_to_teacher";

export type NextStepActivity = {
  type: "lesson" | "learning" | "listening" | "writing" | "speaking" | "vocabulary" | "teacher";
  title: string;
  /** Existing app route. Never invented. */
  to: string;
  params?: { lessonId: string };
};

export type NextStepQuickWinStep = {
  label: string;
  text: string;
};

export type NextStepQuickWin = {
  /** Same focus selected by the existing next-step priority. */
  skill: string;
  title: string;
  steps: readonly [NextStepQuickWinStep, NextStepQuickWinStep, NextStepQuickWinStep];
  cta: string;
  /** Existing app surface opened by the shortcut. */
  activity: NextStepActivity;
};

/**
 * Deterministic situation of the chosen skill AT THE SELECTED LEVEL.
 * Drives the student-facing copy; no invented data, no LLM.
 */
export type NextStepSituation =
  "no_data" | "no_evidence_at_level" | "strong_elsewhere" | "not_practised" | "needs_practice";

export type NextStep = {
  prioritySkill: string | null;
  reason: NextStepReason;
  action: NextStepAction;
  activity: NextStepActivity;
  /** Compact presentation shortcut derived from the same priority skill. */
  quickWin?: NextStepQuickWin | null;
  /**
   * Phase 29: priority Skill Quest, derived server-side from the existing
   * Invisible Gaps. Absent when no valid gap has an executable activity.
   */
  quest?: SkillQuest | null;
  /**
   * Phase 33: at most three review recommendations, already selected and
   * ordered server-side by the Phase 32 engine. Presentation only.
   */
  reviews?: SmartReviewItem[];

  /**
   * The per-skill snapshots this step was decided from (current level first),
   * for the Dashboard skills card only, so the card and the priority agree.
   */
  skills?: {
    skill: string;
    score: number | null;
    cefrLevel: string;
    evidenceCount: number | null;
  }[];
  /** My Progress: the latest measurements of each level, so closed levels stay viewable. */
  skillsByLevel?: {
    level: string;
    skills: {
      skill: string;
      score: number | null;
      cefrLevel: string;
      evidenceCount: number | null;
    }[];
  }[];
  /** Existing evidence for the chosen skill, exposed for contextual display only. */
  insight?: {
    cefrLevel: string | null;
    /** Internal index only. Never displayed to the student. */
    confidence: number | null;
    score: number | null;
    hasEvidence: boolean;
    matchesCurrentLevel: boolean;
    recentlyPractised: boolean;
    situation: NextStepSituation;
    /** Best-performing other skill with evidence at the same level, if any. */
    strongestSkill: string | null;
  };
};

export type NextStepInput = {
  skills: SkillSnapshot[];
  /** Current CEFR level from the existing user profile. */
  currentLevel?: string | null;
  /** learning_profile.common_errors (most recent last). */
  recurringErrors: string[];
  /** Skills practised in the recent window, from existing activities rows. */
  recentlyPractised: string[];
  /** One existing, not-completed lesson per skill, already filtered by level. */
  lessonBySkill: Record<string, { id: string; title: string } | undefined>;
  /**
   * Phase 31: skills whose transfer is already demonstrated (Phase 30), passed
   * as a plain list. It is not a score and never changes score, CEFR or
   * confidence: inside the SAME priority weight, a transferred skill simply
   * yields to a skill with the same kind of need that has not transferred yet.
   */
  transferredSkills?: readonly string[];
};

/**
 * The lesson catalogue labels spoken lessons 'talking'; the skill profile calls
 * the same skill 'speaking'. Map the catalogue label onto the profile label so
 * a real lesson can be matched instead of falling back.
 */
export function lessonSkillToProfileSkill(lessonSkill: string): string {
  return lessonSkill === "talking" ? "speaking" : lessonSkill;
}

/** Existing practice surfaces, used only as fallback when no lesson matches. */
const FALLBACK_BY_SKILL: Record<string, { action: NextStepAction; activity: NextStepActivity }> = {
  listening: {
    action: "practise_listening",
    activity: { type: "listening", title: "Listening Lab", to: "/listening" },
  },
  writing: {
    action: "practise_writing",
    activity: { type: "writing", title: "Writing", to: "/writing" },
  },
  speaking: {
    action: "practise_speaking",
    activity: { type: "speaking", title: "AI Speaking", to: "/coach" },
  },
  pronunciation: {
    action: "practise_speaking",
    activity: { type: "speaking", title: "AI Speaking", to: "/coach" },
  },
  vocabulary: {
    action: "practise_vocabulary",
    activity: { type: "vocabulary", title: "Vocabulary", to: "/vocabulary" },
  },
};

const TEACHER_FALLBACK: { action: NextStepAction; activity: NextStepActivity } = {
  action: "talk_to_teacher",
  activity: { type: "teacher", title: "AI Teacher", to: "/teacher" },
};

const LEARNING_CENTER: NextStepActivity = {
  type: "learning",
  title: "Learning Center",
  to: "/learning",
};

const QUICK_WIN_COPY: Record<string, Omit<NextStepQuickWin, "skill" | "activity">> = {
  vocabulary: {
    title: "Strengthen your vocabulary",
    cta: "Practice vocabulary",
    steps: [
      { label: "Review", text: "5 words you recently missed" },
      { label: "Use", text: "Create 2 sentences with them" },
      { label: "Recall", text: "Try to remember them without looking" },
    ],
  },
  grammar: {
    title: "Strengthen your grammar",
    cta: "Practice grammar",
    steps: [
      { label: "Notice", text: "Review the structure in context" },
      { label: "Build", text: "Create 3 short sentences" },
      { label: "Check", text: "Read them aloud once" },
    ],
  },
  writing: {
    title: "Strengthen your writing",
    cta: "Practice writing",
    steps: [
      { label: "Plan it", text: "Choose one simple idea" },
      { label: "Write", text: "Produce a short paragraph" },
      { label: "Improve", text: "Review the correction carefully" },
    ],
  },
  speaking: {
    title: "Warm up your speaking",
    cta: "Say 5 words out loud",
    steps: [
      { label: "Listen", text: "Hear how the word sounds" },
      { label: "Say it", text: "Use the microphone on 5 words" },
      { label: "Check", text: "Repeat the ones below 70%" },
    ],
  },
  pronunciation: {
    title: "Strengthen your pronunciation",
    cta: "Say 5 words out loud",
    steps: [
      { label: "Listen first", text: "Focus on the target sounds" },
      { label: "Say it", text: "Use the microphone on 5 words" },
      { label: "Check", text: "Repeat the ones below 70%" },
    ],
  },
  listening: {
    title: "Strengthen your listening",
    cta: "Practice listening",
    steps: [
      { label: "Listen first", text: "Catch the main idea first" },
      { label: "Answer", text: "Respond without replaying too much" },
      { label: "Confirm", text: "Check the words you missed" },
    ],
  },
  reading: {
    title: "Strengthen your reading",
    cta: "Practice reading",
    steps: [
      { label: "Skim", text: "Find the main idea quickly" },
      { label: "Scan", text: "Look for two key details" },
      { label: "Explain", text: "Summarise it in one sentence" },
    ],
  },
};

/** Existing smart-review surface: the complementary micro-practice for words. */
const SMART_REVIEW: NextStepActivity = {
  type: "learning",
  title: "Smart review",
  to: "/learning/review",
};

/** Short practice routes that sit next to the main action, never on top of it. */
const PRONUNCIATION_DRILL: NextStepActivity = {
  type: "vocabulary",
  title: "Pronunciation drill",
  to: "/vocabulary",
};
const MISTAKES_PRACTICE: NextStepActivity = {
  type: "learning",
  title: "Fix your recent mistakes",
  to: "/mistakes",
};

function sameRoute(a: NextStepActivity, b: NextStepActivity) {
  return a.to === b.to && a.params?.lessonId === b.params?.lessonId;
}

/**
 * The Quick Win is a five-minute practice for the same skill on a DIFFERENT
 * screen than "Practice now", so the two buttons never open the same place.
 */
function quickWinActivity(
  skill: string,
  selectedActivity: NextStepActivity,
): NextStepActivity | null {
  let activity: NextStepActivity | null;
  if (skill === "vocabulary") activity = SMART_REVIEW;
  else if (skill === "speaking" || skill === "pronunciation") activity = PRONUNCIATION_DRILL;
  else if (skill === "writing") activity = MISTAKES_PRACTICE;
  else if (skill === "listening") activity = FALLBACK_BY_SKILL["listening"]?.activity ?? null;
  else if (skill === "grammar")
    activity = selectedActivity.type === "lesson" ? TEACHER_FALLBACK.activity : MISTAKES_PRACTICE;
  else if (skill === "reading") activity = LEARNING_CENTER;
  else activity = null;
  if (activity && sameRoute(activity, selectedActivity)) return SMART_REVIEW;
  return activity;
}

export function buildQuickWin(
  prioritySkill: string | null,
  selectedActivity: NextStepActivity,
): NextStepQuickWin | null {
  if (!prioritySkill) return null;
  const copy = QUICK_WIN_COPY[prioritySkill];
  const activity = quickWinActivity(prioritySkill, selectedActivity);
  if (!copy || !activity) return null;
  return { skill: prioritySkill, ...copy, activity };
}

/** True when a recurring error text mentions the skill. Simple and explainable. */
function skillHasRecentError(skill: string, errors: string[]): boolean {
  return errors.some((error) => error.toLowerCase().includes(skill.toLowerCase()));
}

function rank(
  skill: SkillSnapshot,
  input: NextStepInput,
): { weight: number; reason: NextStepReason } {
  if (skillHasRecentError(skill.skill, input.recurringErrors))
    return { weight: 0, reason: "recent_errors" };
  if (skill.score === null) return { weight: 1, reason: "not_measured_yet" };
  if (skill.confidence !== null && skill.confidence < 0.5)
    return { weight: 2, reason: "low_confidence" };
  if (!input.recentlyPractised.includes(skill.skill))
    return { weight: 3, reason: "not_practised_recently" };
  return { weight: 4, reason: "lowest_score" };
}

/**
 * Picks one priority skill and one REAL activity. Ties break by lower score,
 * then alphabetically, so the result is stable for the same data.
 */
export function buildNextStep(input: NextStepInput): NextStep {
  const currentLevel = input.currentLevel?.toUpperCase() ?? null;
  // Learning is continuous (user decision): a skill keeps its latest score
  // when the student changes level, so the priority follows the same numbers
  // the Dashboard shows. The level only shapes the wording (situation below).
  const candidates = input.skills.filter((item) => item.skill);
  if (candidates.length === 0) {
    return {
      prioritySkill: null,
      reason: "no_data",
      action: TEACHER_FALLBACK.action,
      activity: TEACHER_FALLBACK.activity,
      quickWin: null,
    };
  }

  const transferred = new Set(input.transferredSkills ?? []);
  const ordered = candidates
    .map((skill) => ({
      skill,
      ...rank(skill, input),
      transferred: transferred.has(skill.skill) ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        a.weight - b.weight ||
        // Same kind of need: the skill already used across contexts goes last.
        a.transferred - b.transferred ||
        (a.skill.score ?? 0) - (b.skill.score ?? 0) ||
        a.skill.skill.localeCompare(b.skill.skill),
    );

  const best = ordered[0]!;
  const matchesCurrentLevel =
    !currentLevel ||
    (best.skill.cefrLevel !== "insufficient_evidence" &&
      best.skill.cefrLevel.toUpperCase() === currentLevel);
  // The whole journey counts: a skill measured at an earlier level is
  // practised, not "new"; the level only names where the student is now.
  const hasEvidence = best.skill.score !== null || best.skill.confidence !== null;
  const recentlyPractised = input.recentlyPractised.includes(best.skill.skill);
  // Strongest OTHER skill with its own evidence at the selected level.
  const strongest = candidates
    .filter(
      (item) =>
        item.skill !== best.skill.skill &&
        item.score !== null &&
        item.cefrLevel !== "insufficient_evidence",
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.skill.localeCompare(b.skill))[0];
  const strongestSkill =
    strongest && (strongest.score ?? 0) >= 70 && (strongest.score ?? 0) > (best.skill.score ?? 0)
      ? strongest.skill
      : null;
  const situation: NextStepSituation = !hasEvidence
    ? "no_evidence_at_level"
    : strongestSkill
      ? "strong_elsewhere"
      : !recentlyPractised
        ? "not_practised"
        : "needs_practice";
  const insight = {
    cefrLevel:
      input.currentLevel ??
      (best.skill.cefrLevel === "insufficient_evidence" ? null : best.skill.cefrLevel),
    confidence: best.skill.confidence,
    score: best.skill.score,
    hasEvidence,
    matchesCurrentLevel,
    recentlyPractised,
    situation,
    strongestSkill,
  };
  const lesson = input.lessonBySkill[best.skill.skill];
  if (lesson) {
    const activity: NextStepActivity = {
      type: "lesson",
      title: lesson.title,
      to: "/learning/$lessonId",
      params: { lessonId: lesson.id },
    };
    return {
      prioritySkill: best.skill.skill,
      reason: best.reason,
      action: "review_lesson",
      insight,
      activity,
      quickWin: buildQuickWin(best.skill.skill, activity),
    };
  }
  const fallback = FALLBACK_BY_SKILL[best.skill.skill] ?? TEACHER_FALLBACK;
  return {
    prioritySkill: best.skill.skill,
    reason: best.reason,
    action: fallback.action,
    insight,
    activity: fallback.activity,
    quickWin: buildQuickWin(best.skill.skill, fallback.activity),
  };
}

/** Factual, positive copy. One entry per reason; nothing is invented. */
export const NEXT_STEP_REASON_TEXT: Record<NextStepReason, string> = {
  recent_errors: "Your next step is based on your learning evidence.",
  low_confidence: "We still have little evidence about this skill.",
  lowest_score: "This is your lowest skill score right now.",
  not_practised_recently: "You have not practised this recently.",
  not_measured_yet: "You have not practiced this skill yet.",
  no_data: "Start anywhere and we will personalise your next step.",
};

/**
 * "Why now?" justification: a short, human explanation of the REAL reason that
 * won the existing priority selection. Same decision as the Next Step — one
 * entry per reason, filled only with {skill} and {level} values the server
 * already resolved. Never exposes score or confidence.
 */
export const NEXT_STEP_WHY_NOW_TEXT: Record<NextStepReason, string> = {
  recent_errors: "Your recent practice shows opportunities to improve in this area.",
  not_measured_yet: "More {skill} evidence will help EVO understand your current level.",
  low_confidence: "More evidence is needed to better understand your {skill} progress.",
  not_practised_recently: "You haven't practised {skill} recently.",
  lowest_score: "{skill} is currently the area that needs more practice.",
  no_data: "Start anywhere and we will personalise your next step.",
};

/**
 * "Why this matters now?" priority line: reuses prioritySkill and the level
 * already resolved by buildNextStep — never a new decision.
 */
export const NEXT_STEP_PRIORITY_TEXT =
  "{skill} is your next area to strengthen in your {level} journey.";

/**
 * Evidence line for the same block: the real cause that produced the priority,
 * one entry per reason. Same decision, no score, no confidence, no technical
 * reason names, and never a repeated action (the buttons execute; this explains).
 */
export const NEXT_STEP_EVIDENCE_TEXT: Record<NextStepReason, string> = {
  recent_errors: "Your recent practice shows opportunities to improve in this area.",
  not_measured_yet: "More {skill} evidence will help EVO understand your current level.",
  low_confidence: "More evidence is needed to better understand your {skill} progress.",
  not_practised_recently: "You haven't practised {skill} recently.",
  lowest_score: "{skill} is currently the area that needs more practice.",
  no_data: "More practice will help EVO understand your learning path.",
};

/**
 * Mobile-only one-line summaries of the same sentences above: same decision,
 * same placeholders, shorter copy so each line fits a narrow screen without
 * truncation. Never rendered on larger screens.
 */
export const NEXT_STEP_PRIORITY_TEXT_SHORT = "{skill} is next in your {level} journey.";

export const NEXT_STEP_EVIDENCE_TEXT_SHORT: Record<NextStepReason, string> = {
  recent_errors: "Recent practice shows room to improve.",
  not_measured_yet: "More {skill} evidence will guide EVO.",
  low_confidence: "More evidence will clarify your progress.",
  not_practised_recently: "You haven't practised {skill} recently.",
  lowest_score: "{skill} needs more practice now.",
  no_data: "Practice will shape your path.",
};

export const NEXT_STEP_PROGRESS_TEXT_SHORT = {
  withStrongSkill: "{strongest} is strong at {level}.",
  neutral: "Your path is taking shape.",
} as const;

/**
 * Evolution context line. The positive variant is only allowed when the server
 * already resolved a strongest other skill with evidence at the same level;
 * otherwise a neutral, factual fallback is used — nothing is invented.
 */
export const NEXT_STEP_PROGRESS_TEXT = {
  withStrongSkill: "Your {strongest} has strong evidence at {level}.",
  neutral: "Your learning evidence shows where to focus next.",
} as const;

export const NEXT_STEP_ACTION_TEXT: Record<NextStepAction, string> = {
  review_lesson: "Review lesson",
  practise_listening: "Practise listening",
  practise_writing: "Practise writing",
  practise_speaking: "Practise speaking",
  practise_vocabulary: "Practise vocabulary",
  talk_to_teacher: "Talk to AI Teacher",
};

/**
 * Templates for the student-facing "what is happening" line. Placeholders are
 * filled with real values only: {skill}, {level}, {strongest}.
 */
export const NEXT_STEP_SITUATION_TEXT: Record<NextStepSituation, string> = {
  no_data: "We do not have your learning data yet.",
  no_evidence_at_level:
    "We are still building your {skill} assessment at {level}. Do a {skill} activity at this level to create new evidence.",
  strong_elsewhere:
    "You are already doing well in {strongest}. Right now {skill} is what needs more practice at {level}.",
  not_practised: "You have not practised {skill} at {level} recently.",
  needs_practice: "Among your {level} results, {skill} is the skill that needs the most attention.",
};

export const NEXT_STEP_SKILL_TEXT: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  pronunciation: "Pronunciation",
};
