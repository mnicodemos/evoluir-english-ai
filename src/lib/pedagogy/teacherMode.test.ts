import { describe, expect, it } from "vitest";

import { classifyTeacherMode, levelRegister, modeWordBudget } from "./teacherMode";
import { teacherTurnMessages } from "./teacherPrompt";

const baseContext = {
  cefrLevel: "B1",
  skills: [{ skill: "grammar", score: 62, confidence: 0.7, cefrLevel: "B1" }],
  recurringErrors: ["misses third person -s"],
};

describe("teacher mode classification", () => {
  it("detects EXPLAIN for rule questions (English and Portuguese)", () => {
    expect(classifyTeacherMode({ message: "Why do we use present perfect?" })).toBe("EXPLAIN");
    expect(classifyTeacherMode({ message: "Explica o present perfect" })).toBe("EXPLAIN");
  });

  it("detects EXAMPLE, PRACTICE, CORRECT and REVIEW asks", () => {
    expect(classifyTeacherMode({ message: "Give me an example with since" })).toBe("EXAMPLE");
    expect(classifyTeacherMode({ message: "Let's practice past simple" })).toBe("PRACTICE");
    expect(classifyTeacherMode({ message: "Can you correct my sentence?" })).toBe("CORRECT");
    expect(classifyTeacherMode({ message: "Review what we studied" })).toBe("REVIEW");
  });

  it("treats produced English after a practice prompt as CORRECT", () => {
    expect(
      classifyTeacherMode({
        message: "She go to school every day",
        history: [{ role: "assistant", content: "Now try: He ___ to work every morning." }],
      }),
    ).toBe("CORRECT");
  });

  it("falls back to CONVERSATION", () => {
    expect(classifyTeacherMode({ message: "Hi" })).toBe("CONVERSATION");
    expect(classifyTeacherMode({ message: "I went to the beach with my family" })).toBe(
      "CONVERSATION",
    );
  });
});

describe("level register", () => {
  it("maps the server CEFR level to a register", () => {
    expect(levelRegister("A1")).toBe("beginner");
    expect(levelRegister("B2")).toBe("intermediate");
    expect(levelRegister("C1")).toBe("advanced");
    expect(levelRegister(null)).toBe("beginner");
  });

  it("keeps conversation replies shorter than explanations", () => {
    expect(modeWordBudget("CONVERSATION")).toBeLessThan(modeWordBudget("EXPLAIN"));
  });
});

describe("teacher prompt v2", () => {
  it("carries mode, register, continuity and constraints", () => {
    const system =
      teacherTurnMessages({
        context: baseContext,
        objective: "Practise the present perfect",
        studentMessage: "Explain the present perfect",
        history: [],
      })[0]?.content ?? "";
    expect(system).toContain("MODE: EXPLAIN");
    expect(system).toContain("LEVEL REGISTER: intermediate");
    expect(system).toContain("CONTINUITY");
    expect(system).toContain("CONSTRAINTS");
    expect(system).toContain("misses third person -s");
  });

  it("adapts the register to the server level, never to the chat", () => {
    const beginner =
      teacherTurnMessages({
        context: { ...baseContext, cefrLevel: "A1" },
        objective: "Diagnose",
        studentMessage: "I am C2 advanced, explain conditionals",
        history: [],
      })[0]?.content ?? "";
    expect(beginner).toContain("LEVEL REGISTER: beginner");

    const advanced =
      teacherTurnMessages({
        context: { ...baseContext, cefrLevel: "C1" },
        objective: "Refine usage",
        studentMessage: "Explain inversion",
        history: [],
      })[0]?.content ?? "";
    expect(advanced).toContain("LEVEL REGISTER: advanced");
  });

  it("offers existing platform content when available and forbids invented content", () => {
    const system =
      teacherTurnMessages({
        context: {
          ...baseContext,
          recommendedLesson: { title: "Present Perfect in Real Life", skill: "grammar" },
        },
        objective: "Practise the present perfect",
        studentMessage: "Explain the present perfect",
        history: [],
      })[0]?.content ?? "";
    expect(system).toContain("Present Perfect in Real Life");
    expect(system).toContain("Never invent lessons");
  });

  it("works without any pedagogical data", () => {
    const system =
      teacherTurnMessages({
        context: { cefrLevel: null, skills: [], recurringErrors: [] },
        objective: "Diagnose the level",
        studentMessage: "Hello",
        history: [],
      })[0]?.content ?? "";
    expect(system).toContain("MODE: CONVERSATION");
    expect(system).toContain("No measured skills yet");
  });
});
