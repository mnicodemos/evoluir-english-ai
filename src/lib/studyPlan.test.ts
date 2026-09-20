import { describe, expect, it } from "vitest";

import { buildStudyPlan, skillSequence, type PlanLesson, type StudyPlanInput } from "./studyPlan";

const lessons: PlanLesson[] = [
  { id: "l1", title: "Listening to a Debate", skill: "listening", level: "b2", completed: true },
  { id: "l2", title: "Defending Your Position", skill: "talking", level: "b2", completed: false },
  { id: "l3", title: "Argument Vocabulary", skill: "vocabulary", level: "b2", completed: false },
];

function input(overrides: Partial<StudyPlanInput> = {}): StudyPlanInput {
  return {
    goal: "conversation",
    dailyMinutes: 30,
    daysPerWeek: 3,
    focus: "balanced",
    level: "b2",
    lessons,
    minutesThisWeek: 45,
    ...overrides,
  };
}

describe("studyPlan", () => {
  it("uses the fixed week days for each frequency", () => {
    expect(buildStudyPlan(input({ daysPerWeek: 2 })).days.map((d) => d.day)).toEqual([
      "Tuesday",
      "Thursday",
    ]);
    expect(buildStudyPlan(input({ daysPerWeek: 3 })).days.map((d) => d.day)).toEqual([
      "Monday",
      "Wednesday",
      "Friday",
    ]);
    expect(buildStudyPlan(input({ daysPerWeek: 7 })).days).toHaveLength(7);
  });

  it("puts the focus area on every other day", () => {
    expect(skillSequence("conversation", "writing", 4)).toEqual([
      "writing",
      "speaking",
      "writing",
      "listening",
    ]);
  });

  it("rotates goal skills when the focus is balanced", () => {
    expect(skillSequence("work", "balanced", 3)).toEqual(["vocabulary", "writing", "speaking"]);
  });

  it("reuses existing lessons and never repeats one in the same week", () => {
    const plan = buildStudyPlan(input({ daysPerWeek: 7, focus: "balanced" }));
    const ids = plan.days.map((d) => d.lessonId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.days.find((d) => d.skill === "speaking")?.title).toBe("Defending Your Position");
  });

  it("falls back to existing practice surfaces when no lesson matches", () => {
    const plan = buildStudyPlan(input({ lessons: [], focus: "listening", daysPerWeek: 2 }));
    expect(plan.days[0]).toMatchObject({
      title: "Listening Lab",
      to: "/listening",
      lessonId: null,
    });
  });

  it("tracks weekly progress from completed lessons and effective minutes", () => {
    const plan = buildStudyPlan(input({ daysPerWeek: 3, focus: "listening", minutesThisWeek: 60 }));
    expect(plan.weeklyMinutesTarget).toBe(90);
    expect(plan.minutesThisWeek).toBe(60);
    expect(plan.completedCount).toBe(1);
    expect(plan.totalCount).toBe(3);
    expect(plan.progressPercent).toBe(33);
  });
});
