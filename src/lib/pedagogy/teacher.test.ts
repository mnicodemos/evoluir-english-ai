import { describe, expect, it } from "vitest";

import {
  teacherEvidence,
  teacherEvidenceDecision,
  TEACHER_RUBRIC_VERSION,
} from "./teacherEvidence";
import { parseTeacherTurn, teacherTurnMessages } from "./teacherPrompt";

const context = {
  cefrLevel: "B2",
  skills: [{ skill: "grammar", score: 75, confidence: 0.8, cefrLevel: "C1" }],
  recurringErrors: ["misses third person -s"],
};

describe("teacher prompt", () => {
  it("builds a system prompt with the server context and no answer keys", () => {
    const messages = teacherTurnMessages({
      context,
      objective: "Practise conditionals",
      studentMessage: "If I had more time, I would travel.",
      history: [{ role: "assistant", content: "Hello!" }],
    });
    const system = messages[0]?.content ?? "";
    expect(messages[0]?.role).toBe("system");
    expect(system).toContain("CONTEXT");
    expect(system).toContain("OBJECTIVE");
    expect(system).toContain("grammar: level C1, score 75");
    expect(system).toContain("Practise conditionals");
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "If I had more time, I would travel.",
    });
  });

  it("works with an empty context", () => {
    const messages = teacherTurnMessages({
      context: { cefrLevel: null, skills: [], recurringErrors: [] },
      objective: "Diagnose the level",
      studentMessage: "Hi",
      history: [],
    });
    expect(messages[0]?.content).toContain("No measured skills yet");
  });

  it("parses a valid turn and rejects an invalid one", () => {
    const parsed = parseTeacherTurn(
      '```json\n{"reply":"Good!","assessable":true,"focus_skill":"grammar","suggested_score":82,"observed_error":null}\n```',
    );
    expect(parsed).toEqual({
      reply: "Good!",
      assessable: true,
      focusSkill: "grammar",
      suggestedScore: 82,
      observedError: null,
    });
    expect(() => parseTeacherTurn("not json")).toThrow();
    expect(() => parseTeacherTurn('{"reply":"hi"}')).toThrow();
    // An unsupported skill is never accepted from the model.
    expect(() =>
      parseTeacherTurn('{"reply":"hi","assessable":true,"focus_skill":"maths"}'),
    ).toThrow();
  });
});

describe("teacher evidence gate", () => {
  const production = {
    assessable: true,
    focusSkill: "grammar",
    suggestedScore: 82,
    studentMessage: "If I had more time, I would travel abroad.",
  };

  it("accepts a real production with a valid skill and score", () => {
    expect(teacherEvidenceDecision(production)).toEqual({
      assess: true,
      skill: "grammar",
      score: 82,
    });
  });

  it("never assesses questions, greetings or unsupported skills", () => {
    expect(
      teacherEvidenceDecision({
        ...production,
        assessable: false,
        studentMessage: "Can you explain the present perfect?",
      }).assess,
    ).toBe(false);
    expect(
      teacherEvidenceDecision({
        ...production,
        studentMessage: "Can you explain the present perfect",
      }).assess,
    ).toBe(true);
    expect(
      teacherEvidenceDecision({ ...production, studentMessage: "What does travel mean?" }).assess,
    ).toBe(false);
    expect(teacherEvidenceDecision({ ...production, focusSkill: "speaking" }).assess).toBe(false);
    expect(teacherEvidenceDecision({ ...production, focusSkill: null }).assess).toBe(false);
    expect(teacherEvidenceDecision({ ...production, studentMessage: "Yes I do" }).assess).toBe(
      false,
    );
  });

  it("rejects missing or out-of-range suggested scores", () => {
    expect(teacherEvidenceDecision({ ...production, suggestedScore: null }).assess).toBe(false);
    expect(teacherEvidenceDecision({ ...production, suggestedScore: 140 }).assess).toBe(false);
    expect(teacherEvidenceDecision({ ...production, suggestedScore: -1 }).assess).toBe(false);
  });

  it("builds evidence on the existing contract with conservative weights", () => {
    const [item] = teacherEvidence({ skill: "grammar", score: 82, turnId: "turn-1" });
    expect(item).toMatchObject({
      skill: "grammar",
      sourceType: "teacher",
      evidenceType: "subscore",
      polarity: "positive",
      rawScore: 82,
      evaluatedBy: "gemini",
      rubricVersion: TEACHER_RUBRIC_VERSION,
    });
    expect(item?.sampleWeight).toBeLessThan(1);
    expect(item?.sourceReliability).toBeLessThan(1);
  });
});
