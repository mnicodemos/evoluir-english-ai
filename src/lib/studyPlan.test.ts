import { describe, expect, it } from "vitest";

import {
  buildStudyPlan,
  planReasonText,
  skillSequence,
  type PlanLesson,
  type StudyPlanInput,
} from "./studyPlan";

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

describe("studyPlan adaptive layer", () => {
  const needs = [
    { skill: "speaking", score: 80, confidence: 0.9, recentlyPractised: true },
    { skill: "listening", score: 40, confidence: 0.8, recentlyPractised: false },
    { skill: "vocabulary", score: null, confidence: null, recentlyPractised: false },
    { skill: "grammar", score: 70, confidence: 0.3, recentlyPractised: true },
  ];

  it("keeps the goal skills but orders them by existing evidence", () => {
    expect(skillSequence("conversation", "balanced", 4, needs)).toEqual([
      "vocabulary",
      "grammar",
      "listening",
      "speaking",
    ]);
  });

  it("keeps the chosen focus area on every other day even with needs", () => {
    const sequence = skillSequence("conversation", "writing", 4, needs);
    expect(sequence[0]).toBe("writing");
    expect(sequence[2]).toBe("writing");
  });

  it("explains the plan from the existing evidence only", () => {
    const plan = buildStudyPlan(input({ daysPerWeek: 7, focus: "balanced", needs }));
    const texts = plan.reasons.map(planReasonText);
    expect(texts).toContain("Vocabulary has not been measured yet");
    expect(texts).toContain("Activities match your level");
    expect(texts).toContain("Your main goal stays the priority");
  });

  it("does not invent evidence when the student has none", () => {
    const plan = buildStudyPlan(input({ needs: [] }));
    expect(plan.reasons.map(planReasonText)).toContain(
      "Complete an activity to personalise your plan further",
    );
  });

  it("keeps working for plans built without evidence (Phase 22A behaviour)", () => {
    expect(skillSequence("work", "balanced", 3)).toEqual(["vocabulary", "writing", "speaking"]);
  });
});
