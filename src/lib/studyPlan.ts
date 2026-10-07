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
  speaking: { title: "AI Speaking", to: "/coach" },
  writing: { title: "Writing", to: "/writing" },
  vocabulary: { title: "Vocabulary", to: "/vocabulary" },
  // Named after the task, not the tool (it opens the AI Teacher); short enough
  // for the Dashboard header cell.
  grammar: { title: "Grammar practice", to: "/teacher" },
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

/**
 * Something the student practised this week (São Paulo date), from activities
 * or lessons completed this week. A completed lesson brings its id and title so
 * the day can show what was actually done.
 */
export type PlanPractice = {
  skill: string;
  date: string;
  lessonId?: string;
  title?: string;
};

export type StudyPlanInput = {
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  focus: StudyFocus;
  level: string | null;
  /** Lessons of the level; `completed` = ever completed, so they are not planned again. */
  lessons: PlanLesson[];
  minutesThisWeek: number;
  /** Existing skill evidence used only to order the non-focus days. */
  needs?: PlanSkillNeed[];
  /** Today's study date (YYYY-MM-DD, São Paulo); the plan covers its Monday–Sunday week. */
  today?: string;
  /** Practice done this week; it marks the plan days of the same skill as done. */
  practice?: PlanPractice[];
};

/** done = practised this week · today · missed = earlier this week, not done · upcoming. */
export type PlanDayStatus = "done" | "today" | "missed" | "upcoming";

export type StudyPlanDay = {
  day: string;
  /** Real date of this plan day in the current week (YYYY-MM-DD). */
  date: string;
  skill: string;
  title: string;
  to: string;
  lessonId: string | null;
  level: string | null;
  /** Done this week (not "ever completed"). */
  completed: boolean;
  status: PlanDayStatus;
};

export type StudyPlan = {
  /** Monday and Sunday of the plan week (YYYY-MM-DD). */
  weekStart: string;
  weekEnd: string;
  today: string;
  /** The day to do now: today's, else the next one not done, else null (week done). */
  nextIndex: number | null;
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

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the week that contains `date` (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export function buildStudyPlan(input: StudyPlanInput): StudyPlan {
  const days = DAYS_BY_FREQUENCY[input.daysPerWeek] ?? DAYS_BY_FREQUENCY[3]!;
  const needs = input.needs ?? [];
  const skills = skillSequence(input.goal, input.focus, days.length, needs);
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const weekStart = mondayOf(today);
  const used = new Set<string>();

  // This week's practice per skill: how many distinct days, and the lessons
  // completed this week (in order), so done days show what was really done.
  const practisedDates = new Map<string, Set<string>>();
  const lessonsDone = new Map<string, PlanPractice[]>();
  for (const event of input.practice ?? []) {
    if (event.date < weekStart || event.date > addDays(weekStart, 6)) continue;
    const dates = practisedDates.get(event.skill) ?? new Set<string>();
    dates.add(event.date);
    practisedDates.set(event.skill, dates);
    if (event.lessonId && event.title) {
      lessonsDone.set(event.skill, [...(lessonsDone.get(event.skill) ?? []), event]);
    }
  }
  const doneSoFar = new Map<string, number>();

  const items: StudyPlanDay[] = days.map((day, i) => {
    const skill = skills[i]!;
    const date = addDays(weekStart, WEEK_DAYS.indexOf(day as (typeof WEEK_DAYS)[number]));
    const fallback = FALLBACK_BY_SKILL[skill] ?? FALLBACK_BY_SKILL["reading"]!;

    // A day is done when its skill was practised this week, one practice day
    // per plan day of that skill.
    const doneCount = doneSoFar.get(skill) ?? 0;
    const completed = doneCount < (practisedDates.get(skill)?.size ?? 0);
    if (completed) {
      doneSoFar.set(skill, doneCount + 1);
      const doneLesson = lessonsDone.get(skill)?.shift();
      if (doneLesson?.lessonId) used.add(doneLesson.lessonId);
      return {
        day,
        date,
        skill,
        title: doneLesson?.title ?? fallback.title,
        to: doneLesson?.lessonId ? `/learning/${doneLesson.lessonId}` : fallback.to,
        lessonId: doneLesson?.lessonId ?? null,
        level: input.level,
        completed: true,
        status: "done",
      };
    }

    // Not done yet: a lesson never completed, else the practice area. A lesson
    // the student already finished is never planned again.
    const dbSkill = lessonSkillOf(skill);
    const lesson =
      input.lessons.find(
        (candidate) =>
          candidate.skill === dbSkill && !candidate.completed && !used.has(candidate.id),
      ) ?? null;
    if (lesson) used.add(lesson.id);
    return {
      day,
      date,
      skill,
      title: lesson ? lesson.title : fallback.title,
      to: lesson ? `/learning/${lesson.id}` : fallback.to,
      lessonId: lesson?.id ?? null,
      level: lesson ? lesson.level : input.level,
      completed: false,
      status: date === today ? "today" : date < today ? "missed" : "upcoming",
    };
  });

  const todayIndex = items.findIndex((item) => item.status === "today");
  const nextUpcoming = items.findIndex((item) => item.status === "upcoming");
  const nextMissed = items.findIndex((item) => item.status === "missed");
  // Today's day first; on a day off, catch up the earliest missed day; else the
  // next planned day.
  const nextIndex =
    todayIndex >= 0
      ? todayIndex
      : nextMissed >= 0
        ? nextMissed
        : nextUpcoming >= 0
          ? nextUpcoming
          : null;

  const completedCount = items.filter((item) => item.completed).length;
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    today,
    nextIndex,
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
