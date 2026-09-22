import { describe, expect, it } from "vitest";

import { aggregateSkillEvidence } from "./aggregateSkill";
import { listeningEvidence, pronunciationEvidence, speakingEvidence } from "./activityEvidence";
import type { AssessmentEvidence } from "./contracts";
import {
  deriveLearningState,
  deriveLearningStates,
  evidenceStage,
  learningStateRank,
  LEARNING_STATE_RULE_VERSION,
} from "./learningState";

function evidence(overrides: Partial<AssessmentEvidence> = {}): AssessmentEvidence {
  return {
    skill: "grammar",
    sourceType: "quiz",
    rawScore: 80,
    sourceReliability: 1,
    evidenceQuality: 0.8,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: "quiz-answer-v1",
    ...overrides,
  };
}

describe("deriveLearningState", () => {
  it("reports insufficient evidence with nothing to read", () => {
    const result = deriveLearningState([]);
    expect(result).toMatchObject({
      state: "INSUFFICIENT_EVIDENCE",
      evidenceCount: 0,
      sustainingCount: 0,
      ruleVersion: LEARNING_STATE_RULE_VERSION,
    });
  });

  it("ignores invalid evidence entirely", () => {
    const result = deriveLearningState([
      evidence({ rawScore: 140 }),
      evidence({ sampleWeight: 0, sourceItemId: "b" }),
      evidence({ skill: "nonsense" as never, sourceItemId: "c" }),
    ]);
    expect(result.state).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("never lets one isolated result sustain a stage", () => {
    const result = deriveLearningState([evidence({ sourceItemId: "one" })]);
    expect(result.state).toBe("EXPOSURE");
    expect(result.evidenceCount).toBe(1);
  });

  it("keeps a weak performance at exposure", () => {
    const result = deriveLearningState([
      evidence({ rawScore: 30, sourceItemId: "1" }),
      evidence({ rawScore: 20, sourceItemId: "2" }),
    ]);
    expect(result.state).toBe("EXPOSURE");
  });

  it("reads a quiz as recognition", () => {
    const result = deriveLearningState([
      evidence({ sourceItemId: "1" }),
      evidence({ sourceItemId: "2" }),
    ]);
    expect(result.state).toBe("RECOGNITION");
    expect(result.sustainingCount).toBe(2);
  });

  it("reads listening comprehension as recognition", () => {
    const result = deriveLearningState(
      listeningEvidence({ itemScores: [90, 85], round: 1, itemCefr: "B1" }),
    );
    expect(result.state).toBe("RECOGNITION");
  });

  it("reads writing as application, and free production as production", () => {
    const writing = (meta?: AssessmentEvidence["metadata"], item = "w") =>
      evidence({
        skill: "writing",
        sourceType: "writing",
        evidenceType: "subscore",
        rubricVersion: "writing-v1",
        sourceItemId: item,
        ...(meta ? { metadata: meta } : {}),
      });
    expect(deriveLearningState([writing(undefined, "a"), writing(undefined, "b")]).state).toBe(
      "APPLICATION",
    );
    expect(
      deriveLearningState([
        writing({ taskType: "production" }, "a"),
        writing({ taskType: "production" }, "b"),
      ]).state,
    ).toBe("PRODUCTION");
  });

  it("reads a real pronunciation attempt as production", () => {
    const attempts = [
      ...pronunciationEvidence({ wordId: "w1", transcript: "schedule", score: 88 }),
      ...pronunciationEvidence({ wordId: "w2", transcript: "thorough", score: 76 }),
    ];
    expect(deriveLearningState(attempts).state).toBe("PRODUCTION");
  });

  it("reads strong conversational production as spontaneous use", () => {
    const turn = (item: string) =>
      evidence({
        skill: "grammar",
        sourceType: "teacher",
        evidenceType: "subscore",
        evaluatedBy: "gemini",
        rubricVersion: "coach-session-v1",
        sourceReliability: 0.6,
        evidenceQuality: 0.6,
        sampleWeight: 0.5,
        rawScore: 82,
        sourceItemId: item,
      });
    expect(deriveLearningState([turn("r1"), turn("r2")]).state).toBe("SPONTANEOUS_USE");
  });

  it("keeps a modest conversational turn at production", () => {
    const turn = (item: string) =>
      evidence({
        sourceType: "teacher",
        evaluatedBy: "gemini",
        rawScore: 64,
        sourceItemId: item,
      });
    expect(deriveLearningState([turn("r1"), turn("r2")]).state).toBe("PRODUCTION");
  });

  it("reports maintenance only when the skill is shown again after an interval", () => {
    const speak = (day: string, item: string) =>
      speakingEvidence({ fluency: 78, grammar: 78, vocabulary: 78 })
        .filter((piece) => piece.skill === "speaking")
        .map((piece) => ({ ...piece, sourceItemId: item, createdAt: day }));
    const sameDay = [...speak("2026-09-01T10:00:00Z", "a"), ...speak("2026-09-01T11:00:00Z", "b")];
    const sameSession = deriveLearningState(sameDay);
    expect(sameSession.maintenance).toBe(false);
    expect(sameSession.state).toBe("PRODUCTION");
    const spaced = [...speak("2026-09-01T10:00:00Z", "a"), ...speak("2026-09-20T10:00:00Z", "b")];
    const result = deriveLearningState(spaced);
    // Maintenance is durability of the stage, so the stage itself is preserved.
    expect(result.state).toBe("PRODUCTION");
    expect(result.maintenance).toBe(true);
  });


  it("counts a duplicated result once", () => {
    const one = evidence({ id: "11111111-1111-4111-8111-111111111111" });
    const result = deriveLearningState([one, { ...one }]);
    expect(result.evidenceCount).toBe(1);
    expect(result.state).toBe("EXPOSURE");
  });

  it("does not let vocabulary recall imply production", () => {
    const card = (item: string) =>
      evidence({
        skill: "vocabulary",
        sourceType: "vocabulary",
        evidenceType: "answer",
        sourceItemId: item,
        rawScore: 100,
      });
    expect(deriveLearningState([card("1"), card("2")]).state).toBe("RECOGNITION");
  });

  it("gives nothing for an activity that was only opened", () => {
    // Viewing produces no evidence at all upstream, so the layer sees nothing.
    expect(deriveLearningState(listeningEvidence({ itemScores: [], round: 1 })).state).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
    expect(
      deriveLearningState(pronunciationEvidence({ wordId: "w", transcript: "  ", score: 0 })).state,
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("keeps the progression ordered", () => {
    expect(learningStateRank("INSUFFICIENT_EVIDENCE")).toBeLessThan(learningStateRank("EXPOSURE"));
    expect(learningStateRank("RECOGNITION")).toBeLessThan(learningStateRank("APPLICATION"));
    expect(learningStateRank("APPLICATION")).toBeLessThan(learningStateRank("PRODUCTION"));
    expect(learningStateRank("PRODUCTION")).toBeLessThan(learningStateRank("SPONTANEOUS_USE"));
    expect(learningStateRank("SPONTANEOUS_USE")).toBeLessThan(learningStateRank("MAINTENANCE"));
  });

  it("does not infer application from a high quiz score alone", () => {
    expect(evidenceStage(evidence({ rawScore: 100 }))).toBe("RECOGNITION");
    expect(evidenceStage(evidence({ metadata: { application: true } }))).toBe("APPLICATION");
  });
});

describe("deriveLearningStates", () => {
  it("derives one state per skill", () => {
    const states = deriveLearningStates([
      ...listeningEvidence({ itemScores: [90, 88], round: 1 }),
      ...pronunciationEvidence({ wordId: "w1", transcript: "schedule", score: 80 }),
      ...pronunciationEvidence({ wordId: "w2", transcript: "thorough", score: 78 }),
    ]);
    expect(states.listening?.state).toBe("RECOGNITION");
    expect(states.pronunciation?.state).toBe("PRODUCTION");
    expect(states.grammar).toBeUndefined();
  });

  it("does not touch score, CEFR or confidence", () => {
    const items = listeningEvidence({ itemScores: [90, 80, 70], round: 1, itemCefr: "B1" });
    const before = aggregateSkillEvidence("listening", items);
    deriveLearningStates(items);
    const after = aggregateSkillEvidence("listening", items);
    expect(after).toEqual(before);
    expect(after.score).toBe(80);
    expect(after.cefr).toBe("B1");
  });
});
