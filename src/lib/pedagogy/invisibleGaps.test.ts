import { describe, expect, it } from "vitest";

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { deriveLearningState, deriveLearningStates } from "./learningState";
import { deriveInvisibleGaps, INVISIBLE_GAP_RULE_VERSION } from "./invisibleGaps";

function evidence(overrides: Partial<AssessmentEvidence> = {}): AssessmentEvidence {
  return {
    skill: "grammar",
    sourceType: "quiz",
    rawScore: 80,
    sourceReliability: 0.9,
    evidenceQuality: 0.9,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: "quiz-v1",
    createdAt: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

/** Two sustaining results of one skill at the given task type. */
function pair(
  skill: PedagogicalSkill,
  sourceType: AssessmentEvidence["sourceType"],
  taskType: string | null,
  options: { score?: number; days?: [string, string] } = {},
) {
  const [first, second] = options.days ?? ["2026-09-01T10:00:00Z", "2026-09-02T10:00:00Z"];
  return ["a", "b"].map((item, index) =>
    evidence({
      skill,
      sourceType,
      rawScore: options.score ?? 85,
      sourceItemId: item,
      createdAt: index === 0 ? first : second,
      ...(taskType ? { metadata: { taskType } } : {}),
    }),
  );
}

function gapFor(skill: PedagogicalSkill, items: AssessmentEvidence[], expected?: string) {
  return deriveInvisibleGaps({
    evidence: items,
    skills: [skill],
    ...(expected ? { expectedStateBySkill: { [skill]: expected as never } } : {}),
  })[0];
}

describe("invisible gaps (Phase 28)", () => {
  it("reports a skill that was never demonstrated as unmeasured", () => {
    const gaps = deriveInvisibleGaps({ evidence: pair("grammar", "quiz", null) });
    const speaking = gaps.find((item) => item.skill === "speaking");
    expect(speaking?.type).toBe("UNMEASURED");
    expect(speaking?.reason).toBe("no_valid_evidence");
    expect(speaking?.ruleVersion).toBe(INVISIBLE_GAP_RULE_VERSION);
    // The measured skill is not reported as unmeasured.
    expect(gaps.find((item) => item.skill === "grammar")?.type).not.toBe("UNMEASURED");
  });

  it("reports insufficient evidence when the existing minimums are not met", () => {
    const single = [evidence({ sourceItemId: "a" })];
    const gap = gapFor("grammar", single);
    expect(gap?.type).toBe("INSUFFICIENT_EVIDENCE");
    expect(gap?.reason).toBe("evidence_below_minimum");
  });

  it("reports no gap when the skill reached everything it can demonstrate", () => {
    // Listening can only ever be demonstrated at recognition, and it was, with
    // later evidence on another day showing durability.
    const items = pair("listening", "listening", null, {
      days: ["2026-09-01T10:00:00Z", "2026-09-20T10:00:00Z"],
    });
    expect(deriveInvisibleGaps({ evidence: items, skills: ["listening"] })).toEqual([]);
  });

  it("reports a production gap when only recognition or application was shown", () => {
    const recognition = gapFor("grammar", pair("grammar", "quiz", null));
    expect(recognition?.type).toBe("PRODUCTION_GAP");
    expect(recognition?.currentState).toBe("RECOGNITION");
    expect(recognition?.expectedState).toBe("PRODUCTION");
    const application = gapFor("writing", pair("writing", "writing", "application"));
    expect(application?.type).toBe("PRODUCTION_GAP");
    expect(application?.currentState).toBe("APPLICATION");
  });

  it("reports a spontaneous use gap only when production was already shown", () => {
    const gap = gapFor("speaking", pair("speaking", "speaking", "production"));
    expect(gap?.type).toBe("SPONTANEOUS_USE_GAP");
    expect(gap?.currentState).toBe("PRODUCTION");
    expect(gap?.expectedState).toBe("SPONTANEOUS_USE");
    // Pronunciation cannot be demonstrated beyond production, so no such gap.
    const pronunciation = gapFor("pronunciation", pair("pronunciation", "pronunciation", null));
    expect(pronunciation?.type).not.toBe("SPONTANEOUS_USE_GAP");
  });

  it("reports a maintenance gap when there is no later evidence on another day", () => {
    const sameDay = pair("speaking", "speaking", "spontaneous_use", {
      days: ["2026-09-01T10:00:00Z", "2026-09-01T18:00:00Z"],
    });
    const gap = gapFor("speaking", sameDay);
    expect(gap?.type).toBe("MAINTENANCE_GAP");
    // Maintenance stays an attribute: the stage is reported untouched.
    expect(gap?.currentState).toBe("SPONTANEOUS_USE");
    const spaced = pair("speaking", "speaking", "spontaneous_use", {
      days: ["2026-09-01T10:00:00Z", "2026-09-25T10:00:00Z"],
    });
    expect(gapFor("speaking", spaced)).toBeUndefined();
  });

  it("uses an expected stage only when the caller supplies one", () => {
    const items = pair("grammar", "quiz", null);
    const withExpectation = gapFor("grammar", items, "SPONTANEOUS_USE");
    expect(withExpectation?.type).toBe("STAGE_GAP");
    expect(withExpectation?.expectedState).toBe("SPONTANEOUS_USE");
    expect(withExpectation?.reason).toBe("stage_below_expected");
    // Without an expectation nothing is invented.
    expect(gapFor("grammar", items)?.type).toBe("PRODUCTION_GAP");
  });

  it("does not let a high score hide a structural gap", () => {
    const perfect = pair("grammar", "quiz", null, { score: 100 });
    const gap = gapFor("grammar", perfect);
    expect(gap?.type).toBe("PRODUCTION_GAP");
  });

  it("does not turn a low score into an invisible gap", () => {
    // Enough evidence for the existing aggregation, but nothing sustained: that
    // is a visible low score, not an invisible gap.
    const weak = pair("grammar", "quiz", null, { score: 30 });
    // No gap at all: the weak result is visible through the score itself.
    expect(gapFor("grammar", weak)).toBeUndefined();
  });

  it("ignores invalid evidence instead of inventing a gap from it", () => {
    const broken = pair("speaking", "speaking", "production").map((item) => ({
      ...item,
      sampleWeight: 0,
    }));
    const gap = gapFor("speaking", broken);
    expect(gap?.type).toBe("UNMEASURED");
  });

  it("is deterministic, ordered and free of side effects", () => {
    const items = [...pair("grammar", "quiz", null), ...pair("speaking", "speaking", "production")];
    const snapshot = JSON.stringify(items);
    const first = deriveInvisibleGaps({ evidence: items });
    const second = deriveInvisibleGaps({ evidence: items });
    expect(second).toEqual(first);
    expect(JSON.stringify(items)).toBe(snapshot);
    // Unmeasured skills come first, then structural gaps.
    expect(first.map((item) => item.priority)).toEqual(
      [...first.map((item) => item.priority)].sort((a, b) => a - b),
    );
  });

  it("leaves the existing learning state untouched", () => {
    const items = pair("speaking", "speaking", "production");
    const before = deriveLearningState(items);
    const statesBefore = deriveLearningStates(items);
    deriveInvisibleGaps({ evidence: items });
    expect(deriveLearningState(items)).toEqual(before);
    expect(deriveLearningStates(items)).toEqual(statesBefore);
  });
});
