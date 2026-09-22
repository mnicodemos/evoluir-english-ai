import { describe, expect, it } from "vitest";

import { aggregateSkillEvidence } from "./aggregateSkill";
import {
  LISTENING_RUBRIC_VERSION,
  PRONUNCIATION_RUBRIC_VERSION,
  SPEAKING_RUBRIC_VERSION,
  listeningEvidence,
  pronunciationEvidence,
  speakingEvidence,
  speakingEvidenceDecision,
} from "./activityEvidence";

describe("listeningEvidence", () => {
  it("creates one item-level evidence per answered sentence", () => {
    const evidence = listeningEvidence({ itemScores: [100, 40], round: 3, itemCefr: "B1" });
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      skill: "listening",
      sourceType: "listening",
      evidenceType: "answer",
      polarity: "positive",
      rawScore: 100,
      itemCefr: "B1",
      evaluatedBy: "deterministic",
      rubricVersion: LISTENING_RUBRIC_VERSION,
    });
    expect(evidence[1]?.polarity).toBe("negative");
  });

  it("produces nothing without measured answers", () => {
    expect(listeningEvidence({ itemScores: [], round: 1 })).toEqual([]);
  });

  it("feeds the existing aggregation without changing it", () => {
    const result = aggregateSkillEvidence(
      "listening",
      listeningEvidence({ itemScores: [90, 80, 70], round: 1, itemCefr: "B1" }),
    );
    expect(result.skill).toBe("listening");
    expect(result.evidenceCount).toBe(3);
    expect(result.score).toBe(80);
  });
});

describe("speaking evidence", () => {
  const spoken = [
    "I think the deadline is too short for this project",
    "We could negotiate a new date with the client",
    "In my last job I handled a similar problem",
  ];

  it("requires real student production", () => {
    expect(speakingEvidenceDecision({ studentMessages: spoken })).toEqual({ assess: true });
    expect(speakingEvidenceDecision({ studentMessages: ["ok", "yes", "hi"] })).toEqual({
      assess: false,
      reason: "insufficient_production",
    });
    expect(speakingEvidenceDecision({ studentMessages: spoken.slice(0, 2) }).assess).toBe(false);
  });

  it("maps the existing report into speaking, grammar and vocabulary", () => {
    const evidence = speakingEvidence({ fluency: 72, grammar: 64, vocabulary: 80 }, "B2");
    expect(evidence.map((item) => item.skill)).toEqual(["speaking", "grammar", "vocabulary"]);
    expect(evidence.every((item) => item.sourceType === "speaking")).toBe(true);
    expect(evidence.every((item) => item.rubricVersion === SPEAKING_RUBRIC_VERSION)).toBe(true);
    expect(evidence.every((item) => item.itemCefr === "B2")).toBe(true);
    expect(evidence[0]?.rawScore).toBe(72);
  });
});

describe("pronunciationEvidence", () => {
  it("records a real attempt", () => {
    const [evidence] = pronunciationEvidence({
      wordId: "33333333-3333-4333-8333-333333333333",
      transcript: "schedule",
      score: 88,
      itemCefr: "A2",
    });
    expect(evidence).toMatchObject({
      skill: "pronunciation",
      sourceType: "pronunciation",
      evidenceType: "answer",
      polarity: "positive",
      rawScore: 88,
      itemCefr: "A2",
      rubricVersion: PRONUNCIATION_RUBRIC_VERSION,
    });
  });

  it("never turns a silent visit into mastery", () => {
    expect(
      pronunciationEvidence({
        wordId: "33333333-3333-4333-8333-333333333333",
        transcript: "   ",
        score: 0,
      }),
    ).toEqual([]);
  });
});
