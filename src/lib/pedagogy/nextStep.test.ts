import { describe, expect, it } from "vitest";

import {
  buildNextStep,
  lessonSkillToProfileSkill,
  NEXT_STEP_REASON_TEXT,
  type NextStepInput,
} from "./nextStep";

const base: NextStepInput = {
  skills: [],
  recurringErrors: [],
  recentlyPractised: [],
  lessonBySkill: {},
};

const skill = (
  name: string,
  score: number | null,
  confidence: number | null = 0.8,
): NextStepInput["skills"][number] => ({
  skill: name,
  score,
  confidence,
  cefrLevel: "B1",
});

describe("next step priority", () => {
  it("prioritises a skill with recent mistakes", () => {
    const step = buildNextStep({
      ...base,
      skills: [skill("grammar", 80), skill("listening", 40)],
      recurringErrors: ["grammar: misses third person -s"],
      recentlyPractised: ["grammar", "listening"],
    });
    expect(step.prioritySkill).toBe("grammar");
    expect(step.reason).toBe("recent_errors");
    expect(step.insight).toEqual({
      cefrLevel: "B1",
      confidence: 0.8,
      hasEvidence: true,
      recentlyPractised: true,
    });
  });

  it("falls back to low confidence, then to not practised, then to lowest score", () => {
    expect(
      buildNextStep({
        ...base,
        skills: [skill("writing", 70, 0.3), skill("reading", 60, 0.9)],
        recentlyPractised: ["writing", "reading"],
      }).reason,
    ).toBe("low_confidence");

    expect(
      buildNextStep({
        ...base,
        skills: [skill("listening", 70), skill("reading", 60)],
        recentlyPractised: ["reading"],
      }).prioritySkill,
    ).toBe("listening");

    const allPractised = buildNextStep({
      ...base,
      skills: [skill("reading", 70), skill("writing", 45)],
      recentlyPractised: ["reading", "writing"],
    });
    expect(allPractised.prioritySkill).toBe("writing");
    expect(allPractised.reason).toBe("lowest_score");
  });

  it("treats a never measured skill as a priority", () => {
    const step = buildNextStep({
      ...base,
      skills: [skill("speaking", null), skill("reading", 50)],
      recentlyPractised: ["speaking", "reading"],
    });
    expect(step.prioritySkill).toBe("speaking");
    expect(step.reason).toBe("not_measured_yet");
  });

  it("breaks ties deterministically", () => {
    const input: NextStepInput = {
      ...base,
      skills: [skill("writing", 50), skill("reading", 50)],
      recentlyPractised: ["writing", "reading"],
    };
    expect(buildNextStep(input).prioritySkill).toBe("reading");
    expect(buildNextStep(input)).toEqual(buildNextStep(input));
  });

  it("guides the student to the AI Teacher when there is no data", () => {
    const step = buildNextStep(base);
    expect(step.prioritySkill).toBeNull();
    expect(step.reason).toBe("no_data");
    expect(step.activity.to).toBe("/teacher");
  });
});

describe("next step content", () => {
  it("uses an existing lesson for the priority skill", () => {
    const step = buildNextStep({
      ...base,
      skills: [skill("listening", 40)],
      lessonBySkill: {
        listening: { id: "11111111-1111-1111-1111-111111111111", title: "Airport talk" },
      },
    });
    expect(step.action).toBe("review_lesson");
    expect(step.activity).toEqual({
      type: "lesson",
      title: "Airport talk",
      to: "/learning/$lessonId",
      params: { lessonId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(step.insight?.cefrLevel).toBe("B1");
    expect(step.insight?.confidence).toBe(0.8);
  });

  it("exposes missing evidence without inventing a value", () => {
    const step = buildNextStep({
      ...base,
      skills: [{ skill: "writing", score: null, confidence: null, cefrLevel: "insufficient_evidence" }],
    });
    expect(step.insight).toEqual({
      cefrLevel: null,
      confidence: null,
      hasEvidence: false,
      recentlyPractised: false,
    });
  });

  it("never uses a lesson from another skill", () => {
    const step = buildNextStep({
      ...base,
      skills: [skill("writing", 40)],
      lessonBySkill: { listening: { id: "abc", title: "Airport talk" } },
    });
    expect(step.activity.title).toBe("Writing");
    expect(step.activity.to).toBe("/writing");
  });

  it("offers an existing practice surface when no lesson matches", () => {
    expect(buildNextStep({ ...base, skills: [skill("listening", 30)] }).activity.to).toBe(
      "/listening",
    );
    expect(buildNextStep({ ...base, skills: [skill("speaking", 30)] }).activity.to).toBe("/coach");
    expect(buildNextStep({ ...base, skills: [skill("pronunciation", 30)] }).activity.to).toBe(
      "/coach",
    );
    expect(buildNextStep({ ...base, skills: [skill("vocabulary", 30)] }).activity.to).toBe(
      "/vocabulary",
    );
    // grammar and reading have no dedicated surface: the teacher is the real fallback.
    expect(buildNextStep({ ...base, skills: [skill("grammar", 30)] }).activity.to).toBe("/teacher");
  });
});

describe("next step copy", () => {
  it("has factual, non-negative copy for every reason", () => {
    for (const text of Object.values(NEXT_STEP_REASON_TEXT)) {
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/bad|weak|poor|terrible/i);
    }
  });
});

describe("lesson catalogue skill labels", () => {
  it("treats a 'talking' lesson as the speaking skill", () => {
    expect(lessonSkillToProfileSkill("talking")).toBe("speaking");
    expect(lessonSkillToProfileSkill("grammar")).toBe("grammar");
    expect(lessonSkillToProfileSkill("pronunciation")).toBe("pronunciation");
  });

  it("uses a spoken lesson for the speaking skill once the label is mapped", () => {
    const step = buildNextStep({
      skills: [{ skill: "speaking", score: 40, confidence: 0.9, cefrLevel: "B2" }],
      recurringErrors: [],
      recentlyPractised: ["speaking"],
      lessonBySkill: {
        [lessonSkillToProfileSkill("talking")]: { id: "lesson-5", title: "Presenting Your Ideas" },
      },
    });
    expect(step.action).toBe("review_lesson");
    expect(step.activity.params).toEqual({ lessonId: "lesson-5" });
  });
});
