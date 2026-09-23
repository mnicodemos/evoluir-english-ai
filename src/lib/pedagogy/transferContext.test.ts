import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import { deriveLearningState } from "./learningState";
import {
  deriveTransferContext,
  deriveTransferContexts,
  evidenceContextKey,
  isContextualProduction,
  TRANSFER_CONTEXT_RULE_VERSION,
} from "./transferContext";

function coachTurn(
  context: string,
  overrides: Partial<AssessmentEvidence> = {},
): AssessmentEvidence {
  return {
    skill: "grammar",
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
    createdAt: "2026-09-20T10:00:00.000Z",
    metadata: { criterion: "coach_session", taskType: "production", context },
    ...overrides,
  };
}

describe("evidenceContextKey", () => {
  it("preserves the context stored in the existing metadata", () => {
    expect(evidenceContextKey(coachTurn("a work meeting where you give your opinion"))).toBe(
      "context:a work meeting where you give your opinion",
    );
  });

  it("falls back to the session/activity and then the round already recorded", () => {
    expect(evidenceContextKey(coachTurn("x", { metadata: {}, sourceId: "session-1" }))).toBe(
      "source:teacher:session-1",
    );
    expect(
      evidenceContextKey(coachTurn("x", { metadata: { round: 3 }, sourceType: "listening" })),
    ).toBe("round:listening:3");
  });

  it("returns null when no context can be identified", () => {
    expect(evidenceContextKey(coachTurn("x", { metadata: {} }))).toBeNull();
  });
});

describe("deriveTransferContext", () => {
  it("does not report transfer for the same skill in the same context", () => {
    const result = deriveTransferContext([
      coachTurn("a work meeting"),
      coachTurn("a work meeting", { createdAt: "2026-09-21T10:00:00.000Z", rawScore: 82 }),
    ]);
    expect(result.transferred).toBe(false);
    expect(result.contexts).toEqual(["context:a work meeting"]);
  });

  it("reports transfer for the same skill in a different context", () => {
    const result = deriveTransferContext([
      coachTurn("a work meeting"),
      coachTurn("a job interview", { createdAt: "2026-09-22T10:00:00.000Z" }),
    ]);
    expect(result).toMatchObject({
      skill: "grammar",
      transferred: true,
      contexts: ["context:a work meeting", "context:a job interview"],
      productionCount: 2,
      ruleVersion: TRANSFER_CONTEXT_RULE_VERSION,
    });
  });

  it("never reports transfer across different skills", () => {
    const perSkill = deriveTransferContexts([
      coachTurn("a work meeting"),
      coachTurn("a job interview", { skill: "writing", sourceType: "writing" }),
    ]);
    expect(perSkill.grammar?.transferred).toBe(false);
    expect(perSkill.writing?.transferred).toBe(false);
  });

  it("ignores invalid evidence", () => {
    const result = deriveTransferContext([
      coachTurn("a work meeting"),
      coachTurn("a job interview", { rawScore: 140, createdAt: "2026-09-22T10:00:00.000Z" }),
      coachTurn("a trip", { sampleWeight: 0, createdAt: "2026-09-23T10:00:00.000Z" }),
    ]);
    expect(result.transferred).toBe(false);
    expect(result.productionCount).toBe(1);
  });

  it("does not create transfer from a high score alone", () => {
    const highScoreRecognition = coachTurn("shopping", {
      sourceType: "vocabulary",
      rawScore: 100,
      metadata: { context: "shopping" },
    });
    expect(isContextualProduction(highScoreRecognition)).toBe(false);
    expect(
      deriveTransferContext([coachTurn("a work meeting"), highScoreRecognition]).transferred,
    ).toBe(false);
  });

  it("does not treat quiz items as contextualised production", () => {
    const quiz = (context: string, createdAt: string): AssessmentEvidence => ({
      ...coachTurn(context, { createdAt }),
      sourceType: "quiz",
      evidenceType: "answer",
      metadata: { context, application: true },
    });
    const result = deriveTransferContext([
      quiz("unit 1", "2026-09-20T10:00:00.000Z"),
      quiz("unit 2", "2026-09-21T10:00:00.000Z"),
    ]);
    expect(result.transferred).toBe(false);
    expect(result.productionCount).toBe(0);
  });

  it("accepts real production from different producers of the same skill", () => {
    const writing: AssessmentEvidence = coachTurn("a complaint email", {
      sourceType: "writing",
      createdAt: "2026-09-24T10:00:00.000Z",
      metadata: { context: "a complaint email", freeProduction: true },
    });
    expect(isContextualProduction(writing)).toBe(true);
    expect(deriveTransferContext([coachTurn("a work meeting"), writing]).transferred).toBe(true);
  });

  it("does not produce a false positive inside one session", () => {
    const session = { sourceId: "conversation-1", metadata: { taskType: "production" } } as const;
    const result = deriveTransferContext([
      coachTurn("x", { ...session, createdAt: "2026-09-20T10:00:00.000Z" }),
      coachTurn("x", { ...session, createdAt: "2026-09-20T10:05:00.000Z", rawScore: 84 }),
      coachTurn("x", { ...session, createdAt: "2026-09-20T10:10:00.000Z", rawScore: 90 }),
    ]);
    expect(result.contexts).toEqual(["source:teacher:conversation-1"]);
    expect(result.transferred).toBe(false);
  });

  it("never changes the Learning State derived by the existing architecture", () => {
    const evidence = [
      coachTurn("a work meeting"),
      coachTurn("a job interview", { createdAt: "2026-09-22T10:00:00.000Z" }),
    ];
    const before = deriveLearningState(evidence);
    const transfer = deriveTransferContext(evidence);
    const after = deriveLearningState(evidence);
    expect(transfer.transferred).toBe(true);
    expect(after).toEqual(before);
    expect(Object.keys(transfer)).not.toContain("state");
  });
});
