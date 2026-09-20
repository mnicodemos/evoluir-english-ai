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

export type StudyPlanInput = {
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  focus: StudyFocus;
  level: string | null;
  lessons: PlanLesson[];
  minutesThisWeek: number;
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
};

export function lessonSkillOf(planSkill: string) {
  return planSkill === "speaking" ? "talking" : planSkill;
}

/** Skill sequence: the focus area every other day, goal skills in between. */
export function skillSequence(goal: string, focus: StudyFocus, slots: number): string[] {
  const goalSkills = SKILLS_BY_GOAL[goal] ?? SKILLS_BY_GOAL["conversation"]!;
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

export function buildStudyPlan(input: StudyPlanInput): StudyPlan {
  const days = DAYS_BY_FREQUENCY[input.daysPerWeek] ?? DAYS_BY_FREQUENCY[3]!;
  const skills = skillSequence(input.goal, input.focus, days.length);
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
    progressPercent: items.length
      ? Math.round((completedCount / items.length) * 100)
      : 0,
  };
}
