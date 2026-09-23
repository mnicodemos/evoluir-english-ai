import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "./contracts";
import { deriveInvisibleGaps, type InvisibleGap } from "./invisibleGaps";
import { deriveLearningState, deriveLearningStates } from "./learningState";
import {
  deriveSkillQuest,
  deriveSkillQuests,
  selectPrioritySkillQuest,
  SKILL_QUEST_RULE_VERSION,
} from "./skillQuest";

function gap(overrides: Partial<InvisibleGap> = {}): InvisibleGap {
  return {
    skill: "speaking",
    type: "PRODUCTION_GAP",
    currentState: "RECOGNITION",
    expectedState: null,
    priority: 3,
    reason: "production_not_demonstrated",
    ruleVersion: "invisible-gaps-v1",
    ...overrides,
  };
}

const PRODUCTIVE = new Set(["writing", "coach", "teacher"]);
const EXISTING_ROUTES = new Set([
  "/listening",
  "/writing",
  "/vocabulary",
  "/coach",
  "/teacher",
  "/learning/$lessonId",
]);

describe("skill quest (Phase 29)", () => {
  it("turns an unmeasured skill into a measuring activity", () => {
    const quest = deriveSkillQuest(
      gap({
        skill: "listening",
        type: "UNMEASURED",
        currentState: "INSUFFICIENT_EVIDENCE",
        reason: "no_valid_evidence",
        priority: 0,
      }),
    );
    expect(quest?.action).toBe("measure_skill");
    expect(quest?.resource.to).toBe("/listening");
    expect(quest?.ruleVersion).toBe(SKILL_QUEST_RULE_VERSION);
  });

  it("turns insufficient evidence into an evidence-collecting activity", () => {
    const quest = deriveSkillQuest(
      gap({
        skill: "vocabulary",
        type: "INSUFFICIENT_EVIDENCE",
        reason: "evidence_below_minimum",
        priority: 1,
      }),
    );
    expect(quest?.action).toBe("add_evidence");
    expect(quest?.resource.to).toBe("/vocabulary");
  });

  it("never sends a production gap to a purely receptive activity", () => {
    const quest = deriveSkillQuest(gap({ skill: "writing" }), {
      gaps: [],
      // A lesson exists, but it cannot demonstrate production.
      lessonBySkill: { writing: { id: "l1", title: "Unit 3" } },
    });
    expect(quest?.action).toBe("produce_language");
    expect(PRODUCTIVE.has(quest?.resource.type ?? "")).toBe(true);
  });

  it("requires a spontaneous-use surface for a spontaneous use gap", () => {
    const quest = deriveSkillQuest(
      gap({
        skill: "speaking",
        type: "SPONTANEOUS_USE_GAP",
        currentState: "PRODUCTION",
        expectedState: "SPONTANEOUS_USE",
        reason: "spontaneous_use_not_demonstrated",
        priority: 4,
      }),
    );
    expect(quest?.targetState).toBe("SPONTANEOUS_USE");
    expect(quest?.resource.ceiling).toBe("SPONTANEOUS_USE");
  });

  it("asks for the same stage again on a maintenance gap and leaves learning state untouched", () => {
    const evidence: AssessmentEvidence[] = ["a", "b"].map((item, index) => ({
      skill: "listening",
      sourceType: "listening",
      rawScore: 85,
      sourceReliability: 0.9,
      evidenceQuality: 0.9,
      sampleWeight: 1,
      evaluatedBy: "deterministic",
      rubricVersion: "listening-v1",
      sourceItemId: item,
      createdAt: index === 0 ? "2026-09-01T10:00:00Z" : "2026-09-01T18:00:00Z",
    }));
    const before = deriveLearningState(evidence);
    const statesBefore = deriveLearningStates(evidence);
    const gaps = deriveInvisibleGaps({ evidence, skills: ["listening"] });
    const quest = deriveSkillQuests({ gaps })[0];
    expect(quest?.action).toBe("demonstrate_again");
    expect(quest?.targetState).toBe("RECOGNITION");
    expect(deriveLearningState(evidence)).toEqual(before);
    expect(deriveLearningStates(evidence)).toEqual(statesBefore);
  });

  it("creates a stage quest only when a valid expectation exists", () => {
    const withExpectation = deriveSkillQuest(
      gap({
        skill: "writing",
        type: "STAGE_GAP",
        expectedState: "PRODUCTION",
        reason: "stage_below_expected",
        priority: 2,
      }),
    );
    expect(withExpectation?.action).toBe("reach_next_stage");
    const without = deriveSkillQuest(
      gap({
        skill: "writing",
        type: "STAGE_GAP",
        expectedState: null,
        reason: "stage_below_expected",
        priority: 2,
      }),
    );
    expect(without).toBeNull();
  });

  it("returns no quest when no existing surface can address the gap", () => {
    // Reading has no dedicated surface today; nothing is invented.
    expect(deriveSkillQuest(gap({ skill: "reading" }))).toBeNull();
    expect(
      deriveSkillQuest(
        gap({ skill: "reading", type: "UNMEASURED", reason: "no_valid_evidence", priority: 0 }),
      ),
    ).toBeNull();
  });

  it("keeps the existing pedagogical priority and picks the most urgent quest", () => {
    const gaps = [
      gap({ skill: "listening", type: "UNMEASURED", reason: "no_valid_evidence", priority: 0 }),
      gap({ skill: "writing", priority: 3 }),
    ];
    const quests = deriveSkillQuests({ gaps });
    expect(quests.map((item) => item.priority)).toEqual([0, 3]);
    expect(selectPrioritySkillQuest({ gaps })?.skill).toBe("listening");
  });

  it("is deterministic and free of side effects", () => {
    const gaps = [gap({ skill: "speaking" }), gap({ skill: "writing", priority: 4 })];
    const snapshot = JSON.stringify(gaps);
    expect(deriveSkillQuests({ gaps })).toEqual(deriveSkillQuests({ gaps }));
    expect(JSON.stringify(gaps)).toBe(snapshot);
  });

  it("always points at a route that really exists", () => {
    const gaps = deriveInvisibleGaps({ evidence: [] });
    for (const quest of deriveSkillQuests({
      gaps,
      lessonBySkill: { grammar: { id: "l1", title: "Unit 1" } },
    })) {
      expect(EXISTING_ROUTES.has(quest.resource.to)).toBe(true);
      if (quest.resource.to === "/learning/$lessonId")
        expect(quest.resource.params?.lessonId).toBeTruthy();
    }
  });
});
