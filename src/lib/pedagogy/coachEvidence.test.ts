import { describe, expect, it } from "vitest";

import {
  COACH_RUBRIC_VERSION,
  coachEvidenceDecision,
  coachEvidenceRound,
} from "./coachSession";
import { teacherEvidence, teacherEvidenceDecision } from "./teacherEvidence";

const production =
  "In the last meeting I explained the delay because the supplier changed the deadline, so I proposed a new plan.";

describe("coachEvidenceDecision", () => {
  it("never assesses the session opening", () => {
    expect(coachEvidenceDecision({ stage: "START", studentMessage: production })).toEqual({
      assess: false,
      reason: "session_start",
    });
  });

  it("rejects short reactions and clicks", () => {
    for (const message of ["ok", "yes please", "start", "thanks!"]) {
      expect(coachEvidenceDecision({ stage: "FEEDBACK", studentMessage: message }).assess).toBe(
        false,
      );
    }
  });

  it("rejects turns without enough production", () => {
    const decision = coachEvidenceDecision({
      stage: "RETRY",
      studentMessage: "I think maybe the plan is ok?",
    });
    expect(decision.assess).toBe(false);
  });

  it("accepts a real production turn inside the session", () => {
    expect(coachEvidenceDecision({ stage: "FEEDBACK", studentMessage: production })).toEqual({
      assess: true,
    });
    expect(coachEvidenceDecision({ stage: "SUMMARY", studentMessage: production }).assess).toBe(
      true,
    );
  });
});

describe("coachEvidenceRound", () => {
  it("keeps the whole feedback -> retry -> adapt cycle in one round", () => {
    expect(coachEvidenceRound(2)).toBe(1);
    expect(coachEvidenceRound(3)).toBe(1);
    expect(coachEvidenceRound(4)).toBe(1);
    expect(coachEvidenceRound(5)).toBe(2);
    expect(coachEvidenceRound(8)).toBe(3);
  });

  it("is stable for the opening turn so a retry cannot shift the key", () => {
    expect(coachEvidenceRound(1)).toBe(1);
    expect(coachEvidenceRound(0)).toBe(1);
  });
});

describe("coach evidence shape", () => {
  it("reuses the teacher evidence model with the coach rubric", () => {
    const decision = teacherEvidenceDecision({
      assessable: true,
      focusSkill: "grammar",
      suggestedScore: 78,
      studentMessage: production,
    });
    expect(decision.assess).toBe(true);
    if (!decision.assess) return;
    const [evidence] = teacherEvidence({
      skill: decision.skill,
      score: decision.score,
      turnId: "11111111-1111-4111-8111-111111111111",
      itemCefr: "B2",
      subskill: "coach_session",
      rubricVersion: COACH_RUBRIC_VERSION,
    });
    expect(evidence).toMatchObject({
      skill: "grammar",
      subskill: "coach_session",
      sourceType: "teacher",
      evidenceType: "subscore",
      polarity: "positive",
      itemCefr: "B2",
      rawScore: 78,
      sourceReliability: 0.6,
      evidenceQuality: 0.6,
      sampleWeight: 0.5,
      rubricVersion: COACH_RUBRIC_VERSION,
    });
  });

  it("keeps the default teacher rubric for free chat", () => {
    const [evidence] = teacherEvidence({
      skill: "writing",
      score: 60,
      turnId: "22222222-2222-4222-8222-222222222222",
    });
    expect(evidence?.subskill).toBe("teacher_interaction");
    expect(evidence?.rubricVersion).toBe("teacher-interaction-v1");
    expect(evidence?.polarity).toBe("negative");
  });
});
