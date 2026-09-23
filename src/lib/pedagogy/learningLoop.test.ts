import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import { deriveInvisibleGaps } from "./invisibleGaps";
import {
  contextualSkills,
  deriveSkillLoopState,
  deriveSkillLoopStates,
  transferredSkills,
} from "./learningLoop";
import { buildNextStep, type NextStepInput } from "./nextStep";
import { deriveSkillQuest, selectPrioritySkillQuest } from "./skillQuest";

function production(
  context: string,
  createdAt: string,
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
    createdAt,
    metadata: { criterion: "coach_session", taskType: "production", context },
    ...overrides,
  };
}

function recognition(createdAt: string, overrides: Partial<AssessmentEvidence> = {}) {
  return production("shopping", createdAt, {
    sourceType: "vocabulary",
    subskill: "word_recall",
    rawScore: 96,
    metadata: { context: "shopping" },
    ...overrides,
  });
}

const baseNextStep: NextStepInput = {
  skills: [],
  currentLevel: "B1",
  recurringErrors: [],
  recentlyPractised: [],
  lessonBySkill: {},
};

describe("deriveSkillLoopState", () => {
  it("state A: no valid production yet", () => {
    const loop = deriveSkillLoopState([recognition("2026-09-20T10:00:00.000Z")]);
    expect(loop.consolidation).toBe("NOT_CONSOLIDATED");
    expect(loop.transfer.transferred).toBe(false);
  });

  it("state A: skill with no evidence at all", () => {
    expect(deriveSkillLoopState([]).consolidation).toBe("NOT_CONSOLIDATED");
  });

  it("state B: one valid production in a single context", () => {
    const loop = deriveSkillLoopState([production("work", "2026-09-20T10:00:00.000Z")]);
    expect(loop.consolidation).toBe("CONTEXTUAL");
    expect(loop.transfer.contexts).toEqual(["context:work"]);
  });

  it("state B: two productions in the SAME context are not transfer", () => {
    const loop = deriveSkillLoopState([
      production("work", "2026-09-20T10:00:00.000Z"),
      production("work", "2026-09-21T10:00:00.000Z"),
    ]);
    expect(loop.consolidation).toBe("CONTEXTUAL");
    expect(loop.transfer.transferred).toBe(false);
  });

  it("state C: two productions in DIFFERENT contexts", () => {
    const loop = deriveSkillLoopState([
      production("work", "2026-09-20T10:00:00.000Z"),
      production("travel", "2026-09-22T10:00:00.000Z"),
    ]);
    expect(loop.consolidation).toBe("TRANSFERRED");
    expect(loop.transfer.contexts).toEqual(["context:work", "context:travel"]);
  });

  it("keeps historical evidence without context working as before", () => {
    const legacy = [
      production("x", "2026-09-20T10:00:00.000Z", { metadata: { taskType: "production" } }),
      production("x", "2026-09-22T10:00:00.000Z", { metadata: { taskType: "production" } }),
    ];
    const loop = deriveSkillLoopState(legacy);
    expect(loop.consolidation).toBe("CONTEXTUAL");
    expect(loop.transfer.contexts).toEqual([]);
    // The stage reported by the existing Learning State layer is untouched.
    expect(loop.learningState.state).toBe("PRODUCTION");
  });

  it("ignores an invalid context value", () => {
    const loop = deriveSkillLoopState([
      production("work", "2026-09-20T10:00:00.000Z"),
      production("   ", "2026-09-22T10:00:00.000Z"),
    ]);
    expect(loop.transfer.contexts).toEqual(["context:work"]);
    expect(loop.consolidation).toBe("CONTEXTUAL");
  });

  it("never turns a quiz into transfer", () => {
    const quiz = (context: string, createdAt: string) =>
      production(context, createdAt, {
        sourceType: "quiz",
        evidenceType: "answer",
        metadata: { context, application: true },
      });
    const loop = deriveSkillLoopState([quiz("unit 1", "2026-09-20T10:00:00.000Z"), quiz("unit 2", "2026-09-21T10:00:00.000Z")]);
    expect(loop.consolidation).toBe("NOT_CONSOLIDATED");
  });

  it("respects chronological order of contexts and is idempotent", () => {
    const evidence = [
      production("travel", "2026-09-22T10:00:00.000Z"),
      production("work", "2026-09-20T10:00:00.000Z"),
    ];
    const first = deriveSkillLoopState(evidence);
    const second = deriveSkillLoopState(evidence);
    expect(first.transfer.contexts).toEqual(["context:work", "context:travel"]);
    expect(second).toEqual(first);
  });

  it("classifies several skills independently", () => {
    const states = deriveSkillLoopStates([
      production("work", "2026-09-20T10:00:00.000Z"),
      production("travel", "2026-09-22T10:00:00.000Z"),
      production("a report", "2026-09-21T10:00:00.000Z", {
        skill: "writing",
        sourceType: "writing",
        metadata: { context: "a report", freeProduction: true },
      }),
      recognition("2026-09-21T10:00:00.000Z", { skill: "vocabulary" }),
    ]);
    expect(states.grammar?.consolidation).toBe("TRANSFERRED");
    expect(states.writing?.consolidation).toBe("CONTEXTUAL");
    expect(states.vocabulary?.consolidation).toBe("NOT_CONSOLIDATED");
    expect(transferredSkills([
      production("work", "2026-09-20T10:00:00.000Z"),
      production("travel", "2026-09-22T10:00:00.000Z"),
    ])).toEqual(["grammar"]);
    expect(contextualSkills([production("work", "2026-09-20T10:00:00.000Z")])).toEqual(["grammar"]);
  });
});

describe("next step with the transfer signal", () => {
  const skills = [
    { skill: "grammar", score: 60, confidence: 0.8, cefrLevel: "B1" },
    { skill: "writing", score: 60, confidence: 0.8, cefrLevel: "B1" },
  ];

  it("keeps the existing deterministic order when no transfer exists", () => {
    const step = buildNextStep({ ...baseNextStep, skills });
    expect(step.prioritySkill).toBe("grammar");
  });

  it("stops treating a transferred skill as the automatic priority", () => {
    const step = buildNextStep({
      ...baseNextStep,
      skills,
      transferredSkills: ["grammar"],
    });
    expect(step.prioritySkill).toBe("writing");
    // Nothing else changes: score, level and confidence are untouched.
    expect(step.insight?.score).toBe(60);
    expect(step.insight?.cefrLevel).toBe("B1");
  });

  it("never lets transfer outrank a stronger real need", () => {
    const step = buildNextStep({
      ...baseNextStep,
      skills: [
        { skill: "grammar", score: 60, confidence: 0.8, cefrLevel: "B1" },
        { skill: "writing", score: null, confidence: null, cefrLevel: "insufficient_evidence" },
      ],
      transferredSkills: ["writing"],
    });
    expect(step.prioritySkill).toBe("writing");
    expect(step.reason).toBe("not_measured_yet");
  });
});

describe("skill quest with the transfer signal", () => {
  const contextualEvidence = [production("work", "2026-09-20T10:00:00.000Z")];

  it("asks for another context while the skill has not transferred", () => {
    const gaps = deriveInvisibleGaps({ evidence: contextualEvidence, skills: ["grammar"] });
    const quest = selectPrioritySkillQuest({ gaps });
    expect(quest?.skill).toBe("grammar");
    expect(quest?.varyContext).toBe(quest ? quest.targetState !== "RECOGNITION" : false);
  });

  it("does not force another variation once transfer is demonstrated", () => {
    const gap = {
      skill: "grammar" as const,
      type: "SPONTANEOUS_USE_GAP" as const,
      currentState: "PRODUCTION" as const,
      expectedState: "SPONTANEOUS_USE" as const,
      priority: 4,
      reason: "spontaneous_use_not_demonstrated" as const,
      ruleVersion: "invisible-gaps-v1",
    };
    expect(deriveSkillQuest(gap, { gaps: [gap] })?.varyContext).toBe(true);
    expect(
      deriveSkillQuest(gap, { gaps: [gap], transferredSkills: ["grammar"] })?.varyContext,
    ).toBe(false);
  });

  it("does not change anything else in the existing quest", () => {
    const gaps = deriveInvisibleGaps({ evidence: contextualEvidence, skills: ["grammar"] });
    const withSignal = selectPrioritySkillQuest({ gaps, transferredSkills: ["grammar"] });
    const without = selectPrioritySkillQuest({ gaps });
    expect({ ...withSignal, varyContext: undefined }).toEqual({
      ...without,
      varyContext: undefined,
    });
  });
});
