import { describe, expect, it } from "vitest";

import type { AssessmentEvidence } from "@/lib/pedagogy/contracts";

import { buildStudyPlan } from "./studyPlan";
import { weekStartNeeds } from "./studyPlanNeeds";

const MONDAY = "2026-10-26";
const weekStartMs = Date.parse(`${MONDAY}T03:00:00Z`);

function answer(skill: string, rawScore: number, createdAt: string): AssessmentEvidence {
  return {
    skill: skill as AssessmentEvidence["skill"],
    sourceType: "quiz",
    itemCefr: "B1",
    rawScore,
    sourceReliability: 0.8,
    evidenceQuality: 0.8,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: "v1",
    createdAt,
  } as AssessmentEvidence;
}

const lastWeek = "2026-10-20T15:00:00Z";
const evidenceBefore = [
  ...Array.from({ length: 6 }, () => answer("speaking", 80, lastWeek)),
  ...Array.from({ length: 6 }, () => answer("grammar", 50, lastWeek)),
  ...Array.from({ length: 6 }, () => answer("listening", 60, lastWeek)),
  ...Array.from({ length: 6 }, () => answer("vocabulary", 70, lastWeek)),
];

describe("weekly plan needs frozen from Monday", () => {
  it("ignores evidence created during the week", () => {
    const monday = weekStartNeeds(evidenceBefore, new Set(), weekStartMs);
    const later = weekStartNeeds(
      [
        ...evidenceBefore,
        ...Array.from({ length: 10 }, () => answer("speaking", 20, "2026-10-26T18:00:00Z")),
      ],
      new Set(),
      weekStartMs,
    );
    expect(later).toEqual(monday);
  });

  it("keeps the day just done in place: the week never reorders", () => {
    const base = {
      goal: "conversation",
      dailyMinutes: 15,
      daysPerWeek: 3,
      focus: "balanced" as const,
      level: "b1",
      lessons: [],
      minutesThisWeek: 0,
      today: MONDAY,
      needs: weekStartNeeds(
        evidenceBefore,
        new Set(["grammar", "listening", "vocabulary"]),
        weekStartMs,
      ),
    };
    const before = buildStudyPlan(base);
    const after = buildStudyPlan({
      ...base,
      practice: [{ skill: before.days[0]!.skill, date: MONDAY }],
    });
    expect(after.days.map((day) => day.skill)).toEqual(before.days.map((day) => day.skill));
    expect(after.days[0]!.status).toBe("done");
    expect(after.completedCount).toBe(1);
  });

  it("leaves Reading out until a daily reading measured it before Monday", () => {
    const quizReading = [
      ...evidenceBefore,
      ...Array.from({ length: 6 }, () => answer("reading", 90, lastWeek)),
    ];
    expect(
      weekStartNeeds(quizReading, new Set(), weekStartMs).some((n) => n.skill === "reading"),
    ).toBe(false);
  });
});
