import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import { deriveInvisibleGaps } from "./invisibleGaps";
import { buildNextStep } from "./nextStep";
import { selectPrioritySkillQuest } from "./skillQuest";
import {
  deriveSmartReview,
  selectSmartReview,
  SMART_REVIEW_RULE_VERSION,
  type SmartReviewInput,
} from "./smartReview";

const NOW = Date.parse("2026-09-30T10:00:00.000Z");
const day = (offset: number) => new Date(NOW - offset * 86_400_000).toISOString();

/** Real production evidence, as the Coach/AI Teacher pipeline already records it. */
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

/** Recognition evidence from a quiz: never contextualised production. */
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

function input(overrides: Partial<SmartReviewInput> = {}): SmartReviewInput {
  return {
    evidence: [],
    currentLevel: "B1",
    recurringErrors: [],
    recentlyPractised: [],
    now: NOW,
    ...overrides,
  };
}

describe("deriveSmartReview", () => {
  it("returns no candidate when there is no history at all", () => {
    expect(deriveSmartReview(input())).toEqual([]);
    expect(selectSmartReview(input())).toBeNull();
  });

  it("selects one candidate from existing evidence", () => {
    const result = deriveSmartReview(
      input({ evidence: [quiz("vocabulary", 2), quiz("vocabulary", 1)] }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      skill: "vocabulary",
      category: "UNCONSOLIDATED_REVIEW",
      ruleVersion: SMART_REVIEW_RULE_VERSION,
    });
  });

  it("orders multiple skills deterministically by pedagogical urgency", () => {
    const result = deriveSmartReview(
      input({
        evidence: [quiz("vocabulary", 2), quiz("vocabulary", 1), quiz("listening", 3)],
        recurringErrors: ["listening comprehension of fast speech"],
      }),
    );
    expect(result.map((item) => item.skill)).toEqual(["listening", "vocabulary"]);
  });

  it("puts a recent error ahead of a low-confidence skill", () => {
    const result = deriveSmartReview(
      input({
        evidence: [quiz("writing", 2), quiz("grammar", 2)],
        skills: [
          { skill: "grammar", score: 40, confidence: 0.2, cefrLevel: "B1" },
          { skill: "writing", score: 80, confidence: 0.9, cefrLevel: "B1" },
        ],
        recurringErrors: ["writing punctuation"],
      }),
    );
    expect(result[0]).toMatchObject({ skill: "writing", category: "ERROR_REVIEW" });
    expect(result[1]).toMatchObject({ skill: "grammar", category: "LOW_CONFIDENCE_REVIEW" });
  });

  it("puts low confidence ahead of a skill that is only unpractised", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          quiz("grammar", 2),
          production("speaking", "a work meeting", 20),
          production("speaking", "a work meeting", 19),
        ],
        skills: [
          { skill: "grammar", score: 55, confidence: 0.3, cefrLevel: "B1" },
          { skill: "speaking", score: 75, confidence: 0.8, cefrLevel: "B1" },
        ],
      }),
    );
    expect(result[0]).toMatchObject({ skill: "grammar", category: "LOW_CONFIDENCE_REVIEW" });
    expect(result.map((item) => item.category)).toContain("DECAY_REVIEW");
  });

  it("lets the time since the last evidence change the decision", () => {
    const recent = deriveSmartReview(
      input({
        evidence: [
          production("speaking", "a work meeting", 2),
          production("speaking", "a work meeting", 1),
        ],
      }),
    );
    expect(recent[0]).toMatchObject({ skill: "speaking", category: "CONTEXT_REVIEW" });

    const old = deriveSmartReview(
      input({
        evidence: [
          production("speaking", "a work meeting", 30),
          production("speaking", "a work meeting", 29),
        ],
      }),
    );
    expect(old[0]).toMatchObject({ skill: "speaking", category: "DECAY_REVIEW" });
    expect(old[0]?.daysSinceLastEvidence).toBe(29);
  });

  it("does not review a skill practised right now without any other need", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          production("speaking", "a work meeting", 1),
          production("speaking", "a work meeting", 0),
        ],
        skills: [{ skill: "speaking", score: 80, confidence: 0.9, cefrLevel: "B1" }],
        recentlyPractised: ["speaking"],
      }),
    );
    expect(result).toEqual([]);
  });

  it("keeps an older skill with a real need as a candidate", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          production("writing", "a complaint email", 40, { sourceType: "writing" }),
          production("writing", "a complaint email", 39, { sourceType: "writing" }),
        ],
        skills: [{ skill: "writing", score: 70, confidence: 0.8, cefrLevel: "B1" }],
      }),
    );
    expect(result[0]).toMatchObject({ skill: "writing", category: "DECAY_REVIEW" });
  });

  it("stops prioritising a skill once transfer is demonstrated", () => {
    const before = deriveSmartReview(
      input({
        evidence: [
          production("grammar", "a work meeting", 3),
          production("grammar", "a work meeting", 2),
        ],
      }),
    );
    expect(before[0]).toMatchObject({ skill: "grammar", category: "CONTEXT_REVIEW" });

    const after = deriveSmartReview(
      input({
        evidence: [
          production("grammar", "a work meeting", 3),
          production("grammar", "a job interview", 2),
        ],
      }),
    );
    expect(after).toEqual([]);
  });

  it("marks a skill without transfer as a contextual review", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          production("grammar", "a work meeting", 3),
          production("grammar", "a work meeting", 2),
        ],
      }),
    );
    expect(result[0]).toMatchObject({
      category: "CONTEXT_REVIEW",
      consolidation: "CONTEXTUAL",
      varyContext: true,
    });
    expect(result[0]?.resource?.to).toBeTruthy();
  });

  it("uses evidence without context for need, never for transfer", () => {
    const noContext = [
      production("grammar", "x", 3, { metadata: { taskType: "production" } }),
      production("grammar", "x", 2, { metadata: { taskType: "production" } }),
    ];
    const result = deriveSmartReview(input({ evidence: noContext }));
    expect(result[0]).toMatchObject({ skill: "grammar", consolidation: "CONTEXTUAL" });
    expect(result[0]?.varyContext).toBe(true);
  });

  it("keeps historical evidence without a timestamp working", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          production("grammar", "a work meeting", 3, { createdAt: null }),
          production("grammar", "a work meeting", 2, { createdAt: null }),
        ],
      }),
    );
    expect(result[0]).toMatchObject({ skill: "grammar", daysSinceLastEvidence: null });
    expect(result[0]?.category).toBe("CONTEXT_REVIEW");
  });

  it("never treats a quiz as contextual production", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          quiz("grammar", 3, { metadata: { context: "unit 1" } }),
          quiz("grammar", 2, { metadata: { context: "unit 2" } }),
        ],
      }),
    );
    expect(result[0]).toMatchObject({
      category: "UNCONSOLIDATED_REVIEW",
      consolidation: "NOT_CONSOLIDATED",
      varyContext: false,
    });
  });

  it("respects the student's own CEFR level and never changes it", () => {
    const result = deriveSmartReview(
      input({
        currentLevel: "B1",
        evidence: [quiz("grammar", 3), quiz("grammar", 2)],
        // Evidence from another level is not borrowed for this level.
        skills: [{ skill: "grammar", score: 90, confidence: 0.9, cefrLevel: "A2" }],
      }),
    );
    expect(result[0]).toMatchObject({ cefrLevel: "B1", score: null, confidence: null });
  });

  it("is deterministic and idempotent for the same input", () => {
    const data = input({
      evidence: [
        quiz("grammar", 3),
        quiz("grammar", 2),
        quiz("listening", 4),
        quiz("listening", 3),
      ],
    });
    expect(deriveSmartReview(data)).toEqual(deriveSmartReview(data));
  });

  it("breaks ties stably by skill name", () => {
    const result = deriveSmartReview(
      input({
        evidence: [
          quiz("listening", 3),
          quiz("listening", 2),
          quiz("grammar", 3),
          quiz("grammar", 2),
        ],
      }),
    );
    expect(result.map((item) => item.skill)).toEqual(["grammar", "listening"]);
  });

  it("does not change the existing Next Step decision", () => {
    const evidence = [quiz("grammar", 3), quiz("grammar", 2)];
    const nextStepInput = {
      skills: [{ skill: "grammar", score: 40, confidence: 0.3, cefrLevel: "B1" }],
      currentLevel: "B1",
      recurringErrors: [],
      recentlyPractised: [],
      lessonBySkill: {},
    };
    const before = buildNextStep(nextStepInput);
    deriveSmartReview(input({ evidence, skills: nextStepInput.skills }));
    expect(buildNextStep(nextStepInput)).toEqual(before);
  });

  it("does not change the existing Skill Quest decision", () => {
    const evidence = [quiz("grammar", 3), quiz("grammar", 2)];
    const gaps = deriveInvisibleGaps({ evidence });
    const before = selectPrioritySkillQuest({ gaps });
    deriveSmartReview(input({ evidence }));
    expect(selectPrioritySkillQuest({ gaps })).toEqual(before);
  });

  it("selects only a review an existing surface can host", () => {
    // Reading has no dedicated surface today, so it never becomes the review.
    const result = selectSmartReview(input({ evidence: [quiz("reading", 3), quiz("reading", 2)] }));
    expect(result).toBeNull();
  });
});
