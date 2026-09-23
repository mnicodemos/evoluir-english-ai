import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import {
  deriveProofOfProgress,
  officialLevelChange,
  PROOF_OF_PROGRESS_KIND_TEXT,
  PROOF_OF_PROGRESS_MAX_HIGHLIGHTS,
  PROOF_OF_PROGRESS_RULE_VERSION,
  type ProofOfProgressInput,
} from "./proofOfProgress";

const NOW = Date.parse("2026-09-30T10:00:00.000Z");
const day = (offset: number) => new Date(NOW - offset * 86_400_000).toISOString();

/** Real production evidence, as the existing Coach/AI Teacher pipeline records it. */
function production(
  skill: AssessmentEvidence["skill"],
  context: string,
  daysAgo: number,
  overrides: Partial<AssessmentEvidence> = {},
): AssessmentEvidence {
  return {
    skill,
    subskill: "coach_session",
    sourceType: "teacher",
    evidenceType: "subscore",
    polarity: "positive",
    rawScore: 78,
    sourceReliability: 0.6,
    evidenceQuality: 0.6,
    sampleWeight: 0.5,
    evaluatedBy: "gemini",
    rubricVersion: "coach-session-v1",
    createdAt: day(daysAgo),
    metadata: { criterion: "coach_session", taskType: "production", context },
    ...overrides,
  };
}

/** Recognition evidence from a quiz: never production, whatever the score is. */
function quiz(
  skill: AssessmentEvidence["skill"],
  daysAgo: number,
  overrides: Partial<AssessmentEvidence> = {},
): AssessmentEvidence {
  return {
    skill,
    sourceType: "quiz",
    evidenceType: "answer",
    polarity: "positive",
    rawScore: 95,
    sourceReliability: 0.7,
    evidenceQuality: 0.7,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: "quiz-v1",
    createdAt: day(daysAgo),
    metadata: { context: "unit 1" },
    ...overrides,
  };
}

function input(over: Partial<ProofOfProgressInput> = {}): ProofOfProgressInput {
  return { evidence: [], currentLevel: "A2", ...over };
}

describe("proof of progress", () => {
  it("1. reports nothing when there is no comparable evidence", () => {
    const result = deriveProofOfProgress(input());
    expect(result.highlights).toEqual([]);
    expect(result.keepPractising).toEqual([]);
    expect(result.levelChange).toBeNull();
  });

  it("2. reports new evidence for a skill that was barely measured before", () => {
    const result = deriveProofOfProgress(
      input({ evidence: [quiz("grammar", 0), quiz("grammar", 0, { rawScore: 80 })] }),
    );
    expect(result.highlights.map((h) => [h.skill, h.kind])).toEqual([["grammar", "NEW_EVIDENCE"]]);
    expect(result.highlights[0]!.previousState).toBeNull();
  });

  it("3. reports consolidation when the demonstrated stage rose", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [
          quiz("writing", 20),
          quiz("writing", 19),
          production("writing", "work", 0, { sourceType: "writing", metadata: { freeProduction: true } }),
          production("writing", "work", 0, {
            sourceType: "writing",
            metadata: { freeProduction: true },
          }),
        ],
      }),
    );
    const writing = result.highlights.find((h) => h.skill === "writing");
    expect(writing?.kind).toBe("CONSOLIDATION");
    expect(writing?.previousState).toBe("RECOGNITION");
    expect(writing?.currentState).toBe("PRODUCTION");
  });

  it("4. recognises valid production as the current stage", () => {
    const result = deriveProofOfProgress(
      input({ evidence: [production("speaking", "travel", 3), production("speaking", "travel", 0)] }),
    );
    const speaking = result.highlights.find((h) => h.skill === "speaking");
    expect(speaking?.currentState).toBe("SPONTANEOUS_USE");
    expect(speaking?.consolidation).toBe("CONTEXTUAL");
  });

  it("5. reports transfer when the skill was produced in different contexts", () => {
    const result = deriveProofOfProgress(
      input({ evidence: [production("grammar", "work", 5), production("grammar", "travel", 0)] }),
    );
    expect(result.highlights[0]!.kind).toBe("TRANSFER");
    expect(result.highlights[0]!.transferred).toBe(true);
  });

  it("6. does not report transfer with a single context", () => {
    const result = deriveProofOfProgress(
      input({ evidence: [production("grammar", "work", 5), production("grammar", "work", 0)] }),
    );
    expect(result.highlights[0]!.transferred).toBe(false);
    expect(result.highlights[0]!.kind).not.toBe("TRANSFER");
  });

  it("7. uses historical skill results to report observable growth", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [production("reading", "news", 0, { sourceType: "reading" })],
        skillHistory: [
          { skill: "reading", score: 40, cefrLevel: "A2", assessedAt: day(30) },
          { skill: "reading", score: 62, cefrLevel: "A2", assessedAt: day(2) },
        ],
      }),
    );
    expect(result.highlights.map((h) => h.kind)).toEqual(["OBSERVABLE_GROWTH"]);
  });

  it("8. handles evidence with no context without claiming transfer", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [
          production("listening", "", 4, { sourceType: "listening", metadata: {} }),
          production("listening", "", 0, { sourceType: "listening", metadata: {} }),
        ],
      }),
    );
    expect(result.highlights.every((h) => h.transferred === false)).toBe(true);
  });

  it("9. never counts a quiz item as production", () => {
    const result = deriveProofOfProgress(
      input({ evidence: [quiz("grammar", 4), quiz("grammar", 0)] }),
    );
    expect(result.highlights[0]!.currentState).toBe("RECOGNITION");
    expect(result.highlights[0]!.kind).not.toBe("TRANSFER");
  });

  it("10. shows no level change when none was officially recorded", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [quiz("grammar", 0)],
        levelHistory: [
          { level: "A2", at: day(40) },
          { level: "A2", at: day(1) },
        ],
      }),
    );
    expect(result.levelChange).toBeNull();
    expect(result.currentLevel).toBe("A2");
  });

  it("11. shows an officially recorded level change", () => {
    expect(
      officialLevelChange([
        { level: "A2", at: day(60) },
        { level: "B1", at: day(1) },
      ]),
    ).toEqual({ from: "A2", to: "B1" });
    expect(officialLevelChange([{ level: "insufficient_evidence", at: day(1) }])).toBeNull();
  });

  it("12. handles multiple skills at once", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [
          production("grammar", "work", 5),
          production("grammar", "travel", 0),
          quiz("vocabulary", 0),
          quiz("vocabulary", 0, { rawScore: 70 }),
        ],
      }),
    );
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights.map((h) => h.skill)).toEqual(["grammar", "vocabulary"]);
  });

  it("13. orders highlights deterministically by kind", () => {
    const result = deriveProofOfProgress(
      input({
        evidence: [
          quiz("vocabulary", 0),
          quiz("vocabulary", 0, { rawScore: 70 }),
          production("grammar", "work", 5),
          production("grammar", "travel", 0),
        ],
      }),
    );
    expect(result.highlights.map((h) => h.kind)).toEqual(["TRANSFER", "NEW_EVIDENCE"]);
  });

  it("14. caps the highlights", () => {
    const evidence = (["grammar", "vocabulary", "reading", "listening", "writing", "speaking"] as const)
      .flatMap((skill) => [production(skill, "work", 5), production(skill, "travel", 0)]);
    const result = deriveProofOfProgress(input({ evidence }));
    expect(result.highlights.length).toBeLessThanOrEqual(PROOF_OF_PROGRESS_MAX_HIGHLIGHTS);
    expect(deriveProofOfProgress(input({ evidence, limit: 3 })).highlights).toHaveLength(3);
  });

  it("15. lists insufficient data as guidance, not as progress", () => {
    const result = deriveProofOfProgress(input({ evidence: [quiz("grammar", 0)] }));
    expect(result.highlights).toEqual([]);
    expect(result.keepPractising).toEqual(["grammar"]);
    expect(PROOF_OF_PROGRESS_KIND_TEXT.TRANSFER).toContain("more than one context");
  });

  it("16. is idempotent for the same input", () => {
    const data = input({
      evidence: [production("grammar", "work", 5), production("grammar", "travel", 0)],
      skillHistory: [{ skill: "grammar", score: 70, cefrLevel: "A2", assessedAt: day(2) }],
    });
    expect(deriveProofOfProgress(data)).toEqual(deriveProofOfProgress(data));
    expect(deriveProofOfProgress(data).ruleVersion).toBe(PROOF_OF_PROGRESS_RULE_VERSION);
  });
});
