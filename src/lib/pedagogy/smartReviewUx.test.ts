import { describe, expect, it } from "vitest";

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import {
  buildSmartReviewList,
  SMART_REVIEW_MAX_ITEMS,
  SMART_REVIEW_REASON_TEXT,
} from "./smartReviewUx";

const DAY = 86_400_000;
const NOW = Date.parse("2026-01-20T12:00:00.000Z");

let seq = 0;
function evidence(
  skill: PedagogicalSkill,
  overrides: Partial<AssessmentEvidence> = {},
): AssessmentEvidence {
  seq += 1;
  return {
    id: `ev-${seq}`,
    skill,
    subskill: null,
    sourceType: "writing",
    sourceId: `src-${seq}`,
    sourceItemId: null,
    rawScore: 80,
    sourceReliability: 0.9,
    evidenceQuality: 0.9,
    sampleWeight: 1,
    evaluatedBy: "ai",
    rubricVersion: "v1",
    metadata: {},
    createdAt: new Date(NOW - DAY).toISOString(),
    ...overrides,
  } as AssessmentEvidence;
}

/** Enough evidence of real production, in a single context. */
function production(skill: PedagogicalSkill, context: string, days: number): AssessmentEvidence[] {
  return [0, 1, 2].map((i) =>
    evidence(skill, {
      sourceType: "writing",
      rawScore: 85,
      metadata: { context },
      createdAt: new Date(NOW - (days + i) * DAY).toISOString(),
    }),
  );
}

describe("Smart Review UX (Phase 33)", () => {
  it("1. presents a single recommendation when only one candidate exists", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 10),
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.skill).toBe("writing");
  });

  it("2. never presents more than three recommendations", () => {
    const items = buildSmartReviewList({
      evidence: [
        ...production("writing", "email", 10),
        ...production("listening", "podcast", 12),
        ...production("speaking", "meeting", 14),
        ...production("vocabulary", "shopping", 16),
        ...production("grammar", "story", 18),
      ],
      now: NOW,
    });
    expect(items.length).toBeLessThanOrEqual(SMART_REVIEW_MAX_ITEMS);
    expect(items).toHaveLength(3);
  });

  it("3. returns an empty list when there is no candidate (no empty card)", () => {
    expect(buildSmartReviewList({ evidence: [], now: NOW })).toEqual([]);
  });

  it("4. surfaces a recent-difficulty review with its own copy", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 1),
      recurringErrors: ["writing: article usage"],
      now: NOW,
    });
    expect(items[0]?.category).toBe("ERROR_REVIEW");
    expect(SMART_REVIEW_REASON_TEXT.ERROR_REVIEW).toMatch(/reinforce/i);
  });

  it("5. surfaces a low-confidence review", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 1),
      skills: [{ skill: "writing", score: 40, confidence: 0.2, cefrLevel: "B1" }],
      currentLevel: "B1",
      now: NOW,
    });
    expect(items[0]?.category).toBe("LOW_CONFIDENCE_REVIEW");
  });

  it("6. surfaces an unconsolidated review", () => {
    const items = buildSmartReviewList({
      evidence: [
        evidence("writing", { sourceType: "quiz", rawScore: 55 }),
        evidence("writing", { sourceType: "quiz", rawScore: 50 }),
      ],
      now: NOW,
    });
    expect(items[0]?.category).toBe("UNCONSOLIDATED_REVIEW");
  });

  it("7. surfaces a time-based review without saying the student forgot", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 30),
      now: NOW,
    });
    expect(items[0]?.category).toBe("DECAY_REVIEW");
    expect(SMART_REVIEW_REASON_TEXT.DECAY_REVIEW).not.toMatch(/forgot|forgotten|esqueceu/i);
  });

  it("8. surfaces a context review and asks for another context", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 1),
      now: NOW,
    });
    expect(items[0]?.category).toBe("CONTEXT_REVIEW");
    expect(items[0]?.varyContext).toBe(true);
    expect(SMART_REVIEW_REASON_TEXT.CONTEXT_REVIEW).toMatch(/context/i);
  });

  it("9. each item points at an existing surface route", () => {
    const items = buildSmartReviewList({
      evidence: [...production("writing", "email", 10), ...production("listening", "audio", 12)],
      now: NOW,
    });
    for (const item of items) {
      expect(item.resource.to.startsWith("/")).toBe(true);
    }
    expect(items.find((i) => i.skill === "listening")?.resource.to).toBe("/listening");
  });

  it("10. a skill with no real surface is never presented", () => {
    const items = buildSmartReviewList({
      evidence: production("reading", "article", 20),
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("11. skips the skill already shown by the next step (no duplication)", () => {
    const input = {
      evidence: [...production("writing", "email", 10), ...production("listening", "audio", 12)],
      now: NOW,
    };
    const all = buildSmartReviewList(input);
    const deduped = buildSmartReviewList(input, { excludeSkills: ["writing"] });
    expect(all.some((i) => i.skill === "writing")).toBe(true);
    expect(deduped.some((i) => i.skill === "writing")).toBe(false);
  });

  it("12. a transferred skill is not presented artificially", () => {
    const items = buildSmartReviewList({
      evidence: [
        ...production("writing", "email", 10),
        ...production("writing", "interview", 12),
      ],
      now: NOW,
    });
    expect(items.some((i) => i.skill === "writing")).toBe(false);
  });

  it("13. missing/still-loading data yields nothing to show", () => {
    expect(buildSmartReviewList({ evidence: [] }, { limit: 3 })).toEqual([]);
  });

  it("14. a limit of zero disables the section entirely (error/fallback path)", () => {
    const items = buildSmartReviewList(
      { evidence: production("writing", "email", 10), now: NOW },
      { limit: 0 },
    );
    expect(items).toEqual([]);
  });

  it("15. keeps the engine order and is idempotent", () => {
    const input = {
      evidence: [...production("writing", "email", 30), ...production("listening", "audio", 12)],
      recurringErrors: ["listening comprehension"],
      now: NOW,
    };
    const first = buildSmartReviewList(input);
    const second = buildSmartReviewList(input);
    expect(first.map((i) => i.skill)).toEqual(second.map((i) => i.skill));
    expect(first[0]?.skill).toBe("listening");
  });

  it("16. exposes no internal score, confidence or stage to the UI", () => {
    const items = buildSmartReviewList({
      evidence: production("writing", "email", 10),
      skills: [{ skill: "writing", score: 88, confidence: 0.91, cefrLevel: "B1" }],
      currentLevel: "B1",
      now: NOW,
    });
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      "category",
      "resource",
      "ruleVersion",
      "skill",
      "varyContext",
    ]);
  });
});
