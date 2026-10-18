import { describe, expect, it } from "vitest";

import { aggregateSkillEvidence, recencyFactor } from "./aggregateSkill";
import type { AssessmentEvidence } from "./contracts";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const answer = (rawScore: number, createdAt?: string): AssessmentEvidence => ({
  skill: "grammar",
  sourceType: "quiz",
  rawScore,
  sourceReliability: 1,
  evidenceQuality: 0.9,
  sampleWeight: 1,
  evaluatedBy: "deterministic",
  rubricVersion: "quiz-answer-v1",
  createdAt: createdAt ?? null,
});

describe("recent answers count more", () => {
  it("halves an answer's weight every 30 days; undated answers count in full", () => {
    expect(recencyFactor(daysAgo(0), 30, NOW)).toBe(1);
    expect(recencyFactor(daysAgo(30), 30, NOW)).toBeCloseTo(0.5);
    expect(recencyFactor(daysAgo(60), 30, NOW)).toBeCloseTo(0.25);
    expect(recencyFactor(undefined, 30, NOW)).toBe(1);
    expect(recencyFactor(daysAgo(60), null, NOW)).toBe(1);
  });

  it("lets a student who improved see it in the score", () => {
    const old = Array.from({ length: 10 }, () => answer(0, daysAgo(90)));
    const recent = Array.from({ length: 10 }, () => answer(100, daysAgo(1)));
    const result = aggregateSkillEvidence("grammar", [...old, ...recent], undefined, NOW);
    // A plain average would say 50; recent work now weighs about 8 times more.
    expect(result.score).toBeGreaterThan(85);
  });

  it("never turns old evidence into 'not measured'", () => {
    const old = [answer(80, daysAgo(400)), answer(60, daysAgo(400))];
    const result = aggregateSkillEvidence("grammar", old, undefined, NOW);
    expect(result.score).toBe(70);
    expect(result.cefr).not.toBe("insufficient_evidence");
  });
});
