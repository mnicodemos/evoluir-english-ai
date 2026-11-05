import { describe, expect, it } from "vitest";

import { aggregateSkillEvidence, countsForSkill } from "./aggregateSkill";
import type { AssessmentEvidence } from "./contracts";

function evidence(overrides: Partial<AssessmentEvidence> = {}): AssessmentEvidence {
  return {
    skill: "grammar",
    sourceType: "quiz",
    rawScore: 80,
    sourceReliability: 1,
    evidenceQuality: 1,
    sampleWeight: 0.25,
    evaluatedBy: "deterministic",
    rubricVersion: "test-v1",
    itemCefr: "B2",
    createdAt: "2026-11-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("Evolution Score evidence criteria", () => {
  it("requires at least two valid evidence items", () => {
    const result = aggregateSkillEvidence(
      "grammar",
      [evidence()],
      undefined,
      Date.parse("2026-11-05T12:00:00.000Z"),
    );

    expect(result).toMatchObject({
      score: null,
      cefr: "insufficient_evidence",
      evidenceCount: 1,
    });
  });

  it("measures a skill when both evidence thresholds are met", () => {
    const result = aggregateSkillEvidence(
      "grammar",
      [evidence(), evidence({ rawScore: 90 })],
      undefined,
      Date.parse("2026-11-05T12:00:00.000Z"),
    );

    expect(result).toMatchObject({
      score: 85,
      evidenceCount: 2,
    });
  });

  it("excludes lesson-quiz evidence from Reading", () => {
    expect(countsForSkill({ skill: "reading", sourceType: "quiz" })).toBe(false);
    expect(countsForSkill({ skill: "reading", sourceType: "reading" })).toBe(true);
  });

  it("does not count invalid evidence toward the measured result", () => {
    const result = aggregateSkillEvidence(
      "grammar",
      [evidence(), evidence({ rawScore: 120 }), evidence({ sampleWeight: 0 })],
      undefined,
      Date.parse("2026-11-05T12:00:00.000Z"),
    );

    expect(result).toMatchObject({
      score: null,
      cefr: "insufficient_evidence",
      evidenceCount: 1,
    });
  });
});
