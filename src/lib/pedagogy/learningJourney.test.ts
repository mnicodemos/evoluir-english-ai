import { describe, expect, it } from "vitest";

import {
  buildLearningJourney,
  LEARNING_JOURNEY_MAX_EVIDENCE_SKILLS,
  LEARNING_JOURNEY_RULE_VERSION,
} from "./learningJourney";
import type { NextStep } from "./nextStep";
import type { ProofOfProgress, ProofOfProgressHighlight } from "./proofOfProgress";
import type { SmartReviewItem } from "./smartReviewUx";

function highlight(
  skill: string,
  kind: ProofOfProgressHighlight["kind"],
  transferred = false,
): ProofOfProgressHighlight {
  return {
    skill: skill as ProofOfProgressHighlight["skill"],
    kind,
    previousState: "RECOGNITION",
    currentState: "PRODUCTION",
    consolidation: "CONTEXTUAL",
    transferred,
    evidenceCount: 3,
    ruleVersion: "proof-of-progress-v1",
  } as ProofOfProgressHighlight;
}

function proof(over: Partial<ProofOfProgress> = {}): ProofOfProgress {
  return {
    currentLevel: "B1",
    levelChange: null,
    highlights: [],
    keepPractising: [],
    ruleVersion: "proof-of-progress-v1",
    ...over,
  };
}

function review(skill: string): SmartReviewItem {
  return {
    skill: skill as SmartReviewItem["skill"],
    category: "DECAY_REVIEW",
    resource: {
      type: "listening",
      title: "Listening practice",
      to: "/listening",
      ceiling: "APPLICATION",
    },
    varyContext: false,
    ruleVersion: "smart-review-v1",
  } as SmartReviewItem;
}

function nextStep(over: Partial<NextStep> = {}): NextStep {
  return {
    prioritySkill: "grammar",
    reason: "lowest_score",
    action: "review_lesson",
    activity: { type: "lesson", title: "Present Perfect", to: "/learning", params: undefined },
    ...over,
  } as NextStep;
}

describe("learning journey (Phase 35)", () => {
  it("1. a student with no history shows no journey data", () => {
    const journey = buildLearningJourney({});
    expect(journey.hasData).toBe(false);
    expect(journey.evidenceSkills).toEqual([]);
    expect(journey.attention).toBeNull();
    expect(journey.nextMove).toBeNull();
  });

  it("2. a student with history shows the journey", () => {
    const journey = buildLearningJourney({
      proof: proof({ highlights: [highlight("grammar", "CONSOLIDATION")] }),
      nextStep: nextStep({ reviews: [review("listening")] }),
    });
    expect(journey.hasData).toBe(true);
    expect(journey.hasProofOfProgress).toBe(true);
  });

  it("3. reuses the official CEFR level", () => {
    expect(buildLearningJourney({ proof: proof({ currentLevel: "B2" }) }).currentLevel).toBe("B2");
    expect(buildLearningJourney({ currentLevel: "A2" }).currentLevel).toBe("A2");
  });

  it("4. reuses Proof of Progress highlights as the evidence skills", () => {
    const journey = buildLearningJourney({
      proof: proof({
        highlights: [highlight("grammar", "TRANSFER", true), highlight("writing", "NEW_EVIDENCE")],
      }),
    });
    expect(journey.evidenceSkills).toEqual(["grammar", "writing"]);
  });

  it("5. reuses the existing Smart Review recommendation", () => {
    const journey = buildLearningJourney({
      nextStep: nextStep({ reviews: [review("listening"), review("writing")] }),
    });
    expect(journey.attention?.skill).toBe("listening");
    expect(journey.attention?.ruleVersion).toBe("smart-review-v1");
  });

  it("6. falls back to the Next Step activity as the next move", () => {
    const journey = buildLearningJourney({ nextStep: nextStep() });
    expect(journey.nextMove).toEqual({
      skill: "grammar",
      title: "Present Perfect",
      to: "/learning",
    });
  });

  it("7. reports transfer when it is already demonstrated", () => {
    const journey = buildLearningJourney({
      proof: proof({ highlights: [highlight("speaking", "TRANSFER", true)] }),
    });
    expect(journey.hasTransfer).toBe(true);
  });

  it("8. absence of transfer is not a failure", () => {
    const journey = buildLearningJourney({
      proof: proof({ highlights: [highlight("speaking", "CONSOLIDATION")] }),
    });
    expect(journey.hasTransfer).toBe(false);
    expect(journey.hasData).toBe(true);
  });

  it("9. resolves the Skill Quest resource when there is one", () => {
    const journey = buildLearningJourney({
      nextStep: nextStep({
        quest: {
          skill: "writing",
          resource: {
            type: "lesson",
            title: "Writing task",
            to: "/learning/$lessonId",
            params: { lessonId: "l1" },
            ceiling: "PRODUCTION",
          },
        } as NextStep["quest"],
      }),
    });
    expect(journey.nextMove).toEqual({
      skill: "writing",
      title: "Writing task",
      to: "/learning/$lessonId",
      params: { lessonId: "l1" },
    });
  });

  it("10. never duplicates the dashboard next-step skill as the attention item", () => {
    // The server already excludes the priority skill from the reviews.
    const journey = buildLearningJourney({
      nextStep: nextStep({ prioritySkill: "grammar", reviews: [review("listening")] }),
    });
    expect(journey.attention?.skill).not.toBe("grammar");
  });

  it("11. does not recreate the Proof of Progress content", () => {
    const journey = buildLearningJourney({
      proof: proof({ highlights: [highlight("grammar", "OBSERVABLE_GROWTH")] }),
    });
    // Only labels are exposed — no copy, kinds list or grouping is rebuilt here.
    expect(Object.keys(journey)).not.toContain("highlights");
    expect(journey.evidenceSkills).toEqual(["grammar"]);
  });

  it("12. keeps the engine order and caps the evidence skills", () => {
    const journey = buildLearningJourney({
      proof: proof({
        highlights: [
          highlight("speaking", "TRANSFER", true),
          highlight("grammar", "CONSOLIDATION"),
          highlight("writing", "OBSERVABLE_GROWTH"),
          highlight("listening", "NEW_EVIDENCE"),
        ],
      }),
    });
    expect(journey.evidenceSkills).toEqual(["speaking", "grammar", "writing"]);
    expect(journey.evidenceSkills.length).toBeLessThanOrEqual(LEARNING_JOURNEY_MAX_EVIDENCE_SKILLS);
  });

  it("13. exposes only presentable, stackable fields (no internal metrics)", () => {
    const journey = buildLearningJourney({
      proof: proof({ highlights: [highlight("grammar", "CONSOLIDATION")] }),
      nextStep: nextStep({ reviews: [review("listening")] }),
    });
    expect(journey).not.toHaveProperty("score");
    expect(journey).not.toHaveProperty("journeyScore");
    expect(journey).not.toHaveProperty("progress");
  });

  it("14. always reports a rule version for the presentation layer", () => {
    expect(buildLearningJourney({}).ruleVersion).toBe(LEARNING_JOURNEY_RULE_VERSION);
  });

  it("15. a partial error in one layer does not break the journey", () => {
    const onlyReview = buildLearningJourney({
      proof: null,
      nextStep: nextStep({ reviews: [review("listening")] }),
    });
    expect(onlyReview.hasData).toBe(true);
    expect(onlyReview.evidenceSkills).toEqual([]);

    const onlyProof = buildLearningJourney({
      proof: proof({ highlights: [highlight("grammar", "CONSOLIDATION")] }),
      nextStep: null,
    });
    expect(onlyProof.hasData).toBe(true);
    expect(onlyProof.nextMove).toBeNull();
  });

  it("16. is idempotent", () => {
    const input = {
      proof: proof({
        highlights: [highlight("grammar", "TRANSFER", true)],
        levelChange: { from: "A2", to: "B1" },
      }),
      nextStep: nextStep({ reviews: [review("listening")] }),
    };
    expect(buildLearningJourney(input)).toEqual(buildLearningJourney(input));
  });
});
