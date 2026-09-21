// Deterministic "next step" layer (Phase 10).
// Pure functions over data the server already owns (current_skill_profile,
// learning_profile.common_errors, activities recency, lessons). No LLM, no new
// profile, no new score, no new CEFR, no new evidence.

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
  type: "lesson" | "listening" | "writing" | "speaking" | "vocabulary" | "teacher";
  title: string;
  /** Existing app route. Never invented. */
  to: string;
  params?: { lessonId: string };
};

/**
 * Deterministic situation of the chosen skill AT THE SELECTED LEVEL.
 * Drives the student-facing copy; no invented data, no LLM.
 */
export type NextStepSituation =
  | "no_data"
  | "no_evidence_at_level"
  | "strong_elsewhere"
  | "not_practised"
  | "needs_practice";

export type NextStep = {
  prioritySkill: string | null;
  reason: NextStepReason;
  action: NextStepAction;
  activity: NextStepActivity;
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
    activity: { type: "speaking", title: "AI Talking", to: "/coach" },
  },
  pronunciation: {
    action: "practise_speaking",
    activity: { type: "speaking", title: "AI Talking", to: "/coach" },
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
  const candidates = input.skills
    .filter((item) => item.skill)
    .map((item) => {
      const evidenceLevel = item.cefrLevel.toUpperCase();
      const matchesCurrentLevel = !currentLevel || evidenceLevel === currentLevel;
      return matchesCurrentLevel
        ? item
        : { ...item, score: null, confidence: null, cefrLevel: "insufficient_evidence" };
    });
  if (candidates.length === 0) {
    return {
      prioritySkill: null,
      reason: "no_data",
      action: TEACHER_FALLBACK.action,
      activity: TEACHER_FALLBACK.activity,
    };
  }

  const ordered = candidates
    .map((skill) => ({ skill, ...rank(skill, input) }))
    .sort(
      (a, b) =>
        a.weight - b.weight ||
        (a.skill.score ?? 0) - (b.skill.score ?? 0) ||
        a.skill.skill.localeCompare(b.skill.skill),
    );

  const best = ordered[0]!;
  const matchesCurrentLevel =
    !currentLevel ||
    (best.skill.cefrLevel !== "insufficient_evidence" &&
      best.skill.cefrLevel.toUpperCase() === currentLevel);
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
  const situation: NextStepSituation =
    !hasEvidence || !matchesCurrentLevel
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
    return {
      prioritySkill: best.skill.skill,
      reason: best.reason,
      action: "review_lesson",
      insight,
      activity: {
        type: "lesson",
        title: lesson.title,
        to: "/learning/$lessonId",
        params: { lessonId: lesson.id },
      },
    };
  }
  const fallback = FALLBACK_BY_SKILL[best.skill.skill] ?? TEACHER_FALLBACK;
  return {
    prioritySkill: best.skill.skill,
    reason: best.reason,
    action: fallback.action,
    insight,
    activity: fallback.activity,
  };
}

/** Factual, positive copy. One entry per reason; nothing is invented. */
export const NEXT_STEP_REASON_TEXT: Record<NextStepReason, string> = {
  recent_errors: "Based on your recent mistakes in this area.",
  low_confidence: "We still have little evidence about this skill.",
  lowest_score: "This is your lowest skill score right now.",
  not_practised_recently: "You have not practised this recently.",
  not_measured_yet: "You have not practised this skill yet.",
  no_data: "Start anywhere and we will personalise your next step.",
};

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
