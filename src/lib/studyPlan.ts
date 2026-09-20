/**
 * My Study Plan (MVP) — a deterministic weekly schedule built only from data the
 * app already stores: the student's profile preferences, the existing lessons for
 * their CEFR level and the existing practice surfaces. No AI call, no new content,
 * no adaptive algorithm and no change to the recommendation engine.
 */

export const STUDY_PLAN_GOALS = [
  { value: "conversation", label: "Improve conversation" },
  { value: "work", label: "English for work" },
  { value: "travel", label: "Travel English" },
  { value: "interview", label: "Interview preparation" },
  { value: "certification", label: "Reach a CEFR level" },
] as const;

export const STUDY_PLAN_MINUTES = [15, 30, 45, 60] as const;

export const STUDY_PLAN_DAYS_PER_WEEK = [2, 3, 5, 7] as const;

export const STUDY_PLAN_FOCUS_AREAS = [
  { value: "grammar", label: "Grammar" },
  { value: "listening", label: "Listening" },
  { value: "speaking", label: "Speaking" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "writing", label: "Writing" },
  { value: "balanced", label: "Balanced" },
] as const;

export type StudyFocus = (typeof STUDY_PLAN_FOCUS_AREAS)[number]["value"];

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Which week days each frequency uses. Fixed, so the plan never shuffles. */
const DAYS_BY_FREQUENCY: Record<number, readonly string[]> = {
  2: ["Tuesday", "Thursday"],
  3: ["Monday", "Wednesday", "Friday"],
  5: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  7: [...WEEK_DAYS],
};

/** Skill order suggested by the main goal, using the existing skill categories. */
const SKILLS_BY_GOAL: Record<string, readonly string[]> = {
  conversation: ["speaking", "listening", "vocabulary", "grammar"],
  work: ["vocabulary", "writing", "speaking", "listening"],
  travel: ["speaking", "listening", "vocabulary", "reading"],
  interview: ["speaking", "vocabulary", "writing", "listening"],
  certification: ["grammar", "reading", "writing", "listening"],
};

/** Existing practice surfaces, used when no lesson of that skill is available. */
const FALLBACK_BY_SKILL: Record<string, { title: string; to: string }> = {
  listening: { title: "Listening Lab", to: "/listening" },
  speaking: { title: "AI Talking", to: "/coach" },
  writing: { title: "Writing", to: "/writing" },
  vocabulary: { title: "Vocabulary", to: "/vocabulary" },
  grammar: { title: "AI Teacher", to: "/teacher" },
  reading: { title: "Learning Center", to: "/learning" },
};

export type PlanLesson = {
  id: string;
  title: string;
  /** Lesson skill as stored in the database ("talking" for speaking). */
  skill: string;
  level: string;
  completed: boolean;
};

/**
 * Existing skill evidence, read as-is from the current skill profile. Nothing is
 * recomputed here: no CEFR change, no new score, no new evidence.
 */
export type PlanSkillNeed = {
  skill: string;
  score: number | null;
  confidence: number | null;
  recentlyPractised: boolean;
};

export type PlanReasonCode =
  | "needs_more_practice"
  | "requires_recent_practice"
  | "not_measured_yet"
  | "low_confidence"
  | "matches_level"
  | "follows_goal"
  | "no_evidence_yet";

export type PlanReason = { code: PlanReasonCode; skill?: string };

export type StudyPlanInput = {
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  focus: StudyFocus;
  level: string | null;
  lessons: PlanLesson[];
  minutesThisWeek: number;
  /** Existing skill evidence used only to order the non-focus days. */
  needs?: PlanSkillNeed[];
};

export type StudyPlanDay = {
  day: string;
  skill: string;
  title: string;
  to: string;
  lessonId: string | null;
  level: string | null;
  completed: boolean;
};

export type StudyPlan = {
  days: StudyPlanDay[];
  weeklyMinutesTarget: number;
  minutesThisWeek: number;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  /** "Why this plan?" — factual reasons derived from the data above. */
  reasons: PlanReason[];
};

export function lessonSkillOf(planSkill: string) {
  return planSkill === "speaking" ? "talking" : planSkill;
}

/**
 * Need weight per skill, mirroring the wording already used by the app: no
 * measurement first, then low confidence, then no recent practice, then the
 * lowest score. Lower weight = higher need.
 */
export function needWeight(need: PlanSkillNeed): number {
  if (need.score === null) return 0;
  if (need.confidence !== null && need.confidence < 0.5) return 1;
  if (!need.recentlyPractised) return 2;
  return 3;
}

function needReason(need: PlanSkillNeed): PlanReasonCode {
  if (need.score === null) return "not_measured_yet";
  if (need.confidence !== null && need.confidence < 0.5) return "low_confidence";
  if (!need.recentlyPractised) return "requires_recent_practice";
  return "needs_more_practice";
}

/** Goal skills reordered by existing evidence. The goal set itself never changes. */
function orderByNeed(goalSkills: readonly string[], needs: PlanSkillNeed[]): string[] {
  if (needs.length === 0) return [...goalSkills];
  const bySkill = new Map(needs.map((need) => [need.skill, need]));
  return [...goalSkills]
    .map((skill, index) => ({ skill, index, need: bySkill.get(skill) ?? null }))
    .sort((a, b) => {
      const wa = a.need ? needWeight(a.need) : 2.5;
      const wb = b.need ? needWeight(b.need) : 2.5;
      return wa - wb || (a.need?.score ?? 0) - (b.need?.score ?? 0) || a.index - b.index;
    })
    .map((entry) => entry.skill);
}

/** Skill sequence: the focus area every other day, goal skills in between. */
export function skillSequence(
  goal: string,
  focus: StudyFocus,
  slots: number,
  needs: PlanSkillNeed[] = [],
): string[] {
  const goalSkills = orderByNeed(SKILLS_BY_GOAL[goal] ?? SKILLS_BY_GOAL["conversation"]!, needs);
  if (focus === "balanced") {
    return Array.from({ length: slots }, (_, i) => goalSkills[i % goalSkills.length]!);
  }
  const others = goalSkills.filter((skill) => skill !== focus);
  const sequence: string[] = [];
  let index = 0;
  for (let i = 0; i < slots; i += 1) {
    if (i % 2 === 0 || others.length === 0) sequence.push(focus);
    else {
      sequence.push(others[index % others.length]!);
      index += 1;
    }
  }
  return sequence;
}

function buildReasons(
  input: StudyPlanInput,
  items: StudyPlanDay[],
  needs: PlanSkillNeed[],
): PlanReason[] {
  const reasons: PlanReason[] = [];
  const planned = new Set(items.map((item) => item.skill));
  const ranked = [...needs]
    .filter((need) => planned.has(need.skill))
    .sort((a, b) => needWeight(a) - needWeight(b) || (a.score ?? 0) - (b.score ?? 0));

  for (const need of ranked.slice(0, 2)) {
    reasons.push({ code: needReason(need), skill: need.skill });
  }
  if (ranked.length === 0) reasons.push({ code: "no_evidence_yet" });
  if (items.some((item) => item.lessonId)) reasons.push({ code: "matches_level" });
  reasons.push({ code: "follows_goal" });
  return reasons;
}

export function buildStudyPlan(input: StudyPlanInput): StudyPlan {
  const days = DAYS_BY_FREQUENCY[input.daysPerWeek] ?? DAYS_BY_FREQUENCY[3]!;
  const needs = input.needs ?? [];
  const skills = skillSequence(input.goal, input.focus, days.length, needs);
  const used = new Set<string>();

  const items: StudyPlanDay[] = days.map((day, i) => {
    const skill = skills[i]!;
    const dbSkill = lessonSkillOf(skill);
    const candidates = input.lessons.filter((lesson) => lesson.skill === dbSkill);
    const lesson =
      candidates.find((candidate) => !candidate.completed && !used.has(candidate.id)) ??
      candidates.find((candidate) => !used.has(candidate.id)) ??
      null;
    if (lesson) used.add(lesson.id);
    const fallback = FALLBACK_BY_SKILL[skill] ?? FALLBACK_BY_SKILL["reading"]!;
    return {
      day,
      skill,
      title: lesson ? lesson.title : fallback.title,
      to: lesson ? `/learning/${lesson.id}` : fallback.to,
      lessonId: lesson?.id ?? null,
      level: lesson ? lesson.level : input.level,
      completed: lesson ? lesson.completed : false,
    };
  });

  const completedCount = items.filter((item) => item.completed).length;
  return {
    days: items,
    weeklyMinutesTarget: input.dailyMinutes * days.length,
    minutesThisWeek: input.minutesThisWeek,
    completedCount,
    totalCount: items.length,
    progressPercent: items.length ? Math.round((completedCount / items.length) * 100) : 0,
    reasons: buildReasons(input, items, needs),
  };
}

const REASON_SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  listening: "Listening",
  speaking: "Speaking",
  vocabulary: "Vocabulary",
  writing: "Writing",
  reading: "Reading",
  pronunciation: "Pronunciation",
};

/** Factual "Why this plan?" lines. Nothing invented, no AI call. */
export function planReasonText(reason: PlanReason): string {
  const skill = reason.skill ? (REASON_SKILL_LABELS[reason.skill] ?? reason.skill) : "";
  switch (reason.code) {
    case "needs_more_practice":
      return `${skill} needs more practice`;
    case "requires_recent_practice":
      return `${skill} requires recent practice`;
    case "not_measured_yet":
      return `${skill} has not been measured yet`;
    case "low_confidence":
      return `${skill} still has little evidence`;
    case "matches_level":
      return "Activities match your level";
    case "follows_goal":
      return "Your main goal stays the priority";
    case "no_evidence_yet":
      return "Complete an activity to personalise your plan further";
  }
}
