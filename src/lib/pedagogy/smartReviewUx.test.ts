import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import type { SmartReviewInput } from "./smartReview";
import {
  buildSmartReviewList,
  SMART_REVIEW_MAX_ITEMS,
  SMART_REVIEW_REASON_TEXT,
} from "./smartReviewUx";

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

describe("Smart Review UX (Phase 33)", () => {
  it("1. presents a single recommendation when only one candidate exists", () => {
    const items = buildSmartReviewList(input({ evidence: [quiz("vocabulary", 2)] }));
    expect(items).toHaveLength(1);
    expect(items[0]?.skill).toBe("vocabulary");
  });

  it("2. never presents more than three recommendations", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [
          quiz("vocabulary", 2),
          quiz("listening", 3),
          quiz("writing", 4),
          quiz("grammar", 5),
          quiz("speaking", 6),
        ],
      }),
    );
    expect(items).toHaveLength(SMART_REVIEW_MAX_ITEMS);
  });

  it("3. returns an empty list when there is no candidate (no empty card)", () => {
    expect(buildSmartReviewList(input())).toEqual([]);
  });

  it("4. surfaces a recent-difficulty review with its own copy", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [quiz("writing", 2)],
        recurringErrors: ["writing punctuation"],
      }),
    );
    expect(items[0]?.category).toBe("ERROR_REVIEW");
    expect(SMART_REVIEW_REASON_TEXT.ERROR_REVIEW).toMatch(/reinforce/i);
  });

  it("5. surfaces a low-confidence review", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [quiz("grammar", 2)],
        skills: [{ skill: "grammar", score: 40, confidence: 0.2, cefrLevel: "B1" }],
      }),
    );
    expect(items[0]?.category).toBe("LOW_CONFIDENCE_REVIEW");
  });

  it("6. surfaces an unconsolidated review", () => {
    const items = buildSmartReviewList(input({ evidence: [quiz("vocabulary", 2)] }));
    expect(items[0]?.category).toBe("UNCONSOLIDATED_REVIEW");
  });

  it("7. surfaces a time-based review without saying the student forgot", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [
          production("writing", "a complaint email", 40, { sourceType: "writing" }),
          production("writing", "a complaint email", 39, { sourceType: "writing" }),
        ],
        skills: [{ skill: "writing", score: 70, confidence: 0.8, cefrLevel: "B1" }],
      }),
    );
    expect(items[0]?.category).toBe("DECAY_REVIEW");
    expect(SMART_REVIEW_REASON_TEXT.DECAY_REVIEW).not.toMatch(/forgot|forgotten/i);
  });

  it("8. surfaces a context review and asks for another context", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [
          production("grammar", "a work meeting", 3),
          production("grammar", "a work meeting", 2),
        ],
      }),
    );
    expect(items[0]?.category).toBe("CONTEXT_REVIEW");
    expect(items[0]?.varyContext).toBe(true);
    expect(SMART_REVIEW_REASON_TEXT.CONTEXT_REVIEW).toMatch(/context/i);
  });

  it("9. each item points at an existing surface route", () => {
    const items = buildSmartReviewList(
      input({ evidence: [quiz("listening", 3), quiz("writing", 4)] }),
    );
    for (const item of items) expect(item.resource.to.startsWith("/")).toBe(true);
    expect(items.find((i) => i.skill === "listening")?.resource.to).toBe("/listening");
  });

  it("10. a skill with no real surface is never presented", () => {
    const items = buildSmartReviewList(input({ evidence: [quiz("reading", 3)] }));
    expect(items).toEqual([]);
  });

  it("11. skips the skill already shown by the next step (no duplication)", () => {
    const data = input({ evidence: [quiz("writing", 3), quiz("listening", 4)] });
    const all = buildSmartReviewList(data);
    const deduped = buildSmartReviewList(data, { excludeSkills: ["writing"] });
    expect(all.some((i) => i.skill === "writing")).toBe(true);
    expect(deduped.some((i) => i.skill === "writing")).toBe(false);
  });

  it("12. a transferred skill is not presented artificially", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [
          production("grammar", "a work meeting", 3),
          production("grammar", "a job interview", 2),
        ],
      }),
    );
    expect(items.some((i) => i.skill === "grammar")).toBe(false);
  });

  it("13. missing/still-loading data yields nothing to show", () => {
    expect(buildSmartReviewList({ evidence: [] })).toEqual([]);
  });

  it("14. a limit of zero hides the section entirely (error/fallback path)", () => {
    const items = buildSmartReviewList(input({ evidence: [quiz("writing", 3)] }), { limit: 0 });
    expect(items).toEqual([]);
  });

  it("15. keeps the engine order and is idempotent", () => {
    const data = input({
      evidence: [quiz("vocabulary", 2), quiz("listening", 3)],
      recurringErrors: ["listening comprehension of fast speech"],
    });
    const first = buildSmartReviewList(data);
    const second = buildSmartReviewList(data);
    expect(first.map((i) => i.skill)).toEqual(second.map((i) => i.skill));
    expect(first[0]?.skill).toBe("listening");
  });

  it("16. exposes no internal score, confidence or stage to the UI", () => {
    const items = buildSmartReviewList(
      input({
        evidence: [quiz("writing", 3)],
        skills: [{ skill: "writing", score: 88, confidence: 0.91, cefrLevel: "B1" }],
      }),
    );
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      "category",
      "resource",
      "ruleVersion",
      "skill",
      "varyContext",
    ]);
  });
});
