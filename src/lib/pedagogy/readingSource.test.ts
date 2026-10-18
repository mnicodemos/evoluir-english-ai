import { describe, expect, it } from "vitest";

import { dailyReadingEvidence } from "./activityEvidence";
import { aggregateSkillEvidence, countsForSkill } from "./aggregateSkill";
import type { AssessmentEvidence } from "./contracts";
import { withoutUnmeasuredReading } from "./readingSource.server";

const quizReading = (rawScore: number): AssessmentEvidence => ({
  skill: "reading",
  subskill: "reading_comprehension",
  sourceType: "quiz",
  rawScore,
  sourceReliability: 1,
  evidenceQuality: 0.9,
  sampleWeight: 1,
  evaluatedBy: "deterministic",
  rubricVersion: "quiz-answer-v1",
});

describe("Reading comes from the daily reading only", () => {
  it("ignores the Reading answers lesson quizzes wrote before", () => {
    expect(countsForSkill({ skill: "reading", sourceType: "quiz" })).toBe(false);
    expect(countsForSkill({ skill: "reading", sourceType: "reading" })).toBe(true);
    expect(countsForSkill({ skill: "grammar", sourceType: "quiz" })).toBe(true);
  });

  it("scores Reading from the daily reading answers alone", () => {
    const old = Array.from({ length: 20 }, () => quizReading(0));
    expect(aggregateSkillEvidence("reading", old).score).toBeNull();
    const reading = dailyReadingEvidence({ correct: [true, true, false, true], day: "2026-10-18" });
    expect(aggregateSkillEvidence("reading", [...old, ...reading]).score).toBe(75);
  });

  it("hides the old quiz-based Reading result until a daily reading measured it", () => {
    const rows = [{ skill: "reading" }, { skill: "grammar" }];
    expect(withoutUnmeasuredReading(rows, false).map((row) => row.skill)).toEqual(["grammar"]);
    expect(withoutUnmeasuredReading(rows, true)).toHaveLength(2);
  });
});
