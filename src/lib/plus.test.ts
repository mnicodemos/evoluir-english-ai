import { describe, expect, it } from "vitest";

import {
  evolutionScore,
  evolutionScoreComposition,
  evolutionScoreSkillContribution,
  goalsReport,
  fallbackPlusStep,
  guessPlusArea,
  parsePlusSteps,
  plusDayComplete,
  plusGoalWeek,
  plusScoreProgress,
} from "./plus";

describe("guessPlusArea", () => {
  it("reads the area from the goal's words", () => {
    expect(guessPlusArea("Falar inglês em reuniões")).toBe("english");
    expect(guessPlusArea("Guardar R$ 300 por mês")).toBe("money");
    expect(guessPlusArea("Caminhar 3 vezes por semana")).toBe("health");
    expect(guessPlusArea("Ler um livro por mês")).toBe("other");
  });
});

describe("fallbackPlusStep", () => {
  it("changes from one day to the next and follows the language", () => {
    const monday = fallbackPlusStep("health", "2026-10-05", "pt");
    const tuesday = fallbackPlusStep("health", "2026-10-06", "pt");
    expect(monday).not.toBe(tuesday);
    expect(fallbackPlusStep("health", "2026-10-05", "en")).toMatch(/^[A-Z]/);
    expect(fallbackPlusStep("money", "2026-10-05", "pt")).toBe(
      fallbackPlusStep("money", "2026-10-05", "pt"),
    );
  });
});

describe("parsePlusSteps", () => {
  const ids = ["a", "b", "c"];

  it("keeps each valid step and drops the bad ones", () => {
    const raw =
      'Here: {"steps":[{"goal_id":"a","step":"  Caminhe 15   minutos hoje. "},' +
      '{"goal_id":"b","step":"ok"},{"goal_id":"zzz","step":"Unknown goal step"},' +
      '{"goal_id":"a","step":"Second step for a"},{"step":"no id"}]}';
    const steps = parsePlusSteps(raw, ids);
    expect([...steps.entries()]).toEqual([["a", "Caminhe 15 minutos hoje."]]);
  });

  it("returns nothing for a broken reply", () => {
    expect(parsePlusSteps("not json", ids).size).toBe(0);
    expect(parsePlusSteps('{"steps":"x"}', ids).size).toBe(0);
  });

  it("shortens a long step", () => {
    const steps = parsePlusSteps(
      JSON.stringify({ steps: [{ goal_id: "c", step: "x".repeat(300) }] }),
      ids,
    );
    expect(steps.get("c")).toHaveLength(160);
  });
});

describe("plusDayComplete", () => {
  it("needs at least one step, all done", () => {
    expect(plusDayComplete([])).toBe(false);
    expect(plusDayComplete([{ doneAt: "t" }, { doneAt: null }])).toBe(false);
    expect(plusDayComplete([{ doneAt: "t" }, { doneAt: "t" }])).toBe(true);
  });
});

describe("evolutionScore", () => {
  it("weighs English and goals the same", () => {
    expect(evolutionScore({ englishSkills: [80, 60, null], stepsGiven: 10, stepsDone: 5 })).toEqual(
      {
        score: 60,
        english: 70,
        goals: 50,
      },
    );
  });

  it("uses whichever part is measured", () => {
    expect(evolutionScore({ englishSkills: [null], stepsGiven: 4, stepsDone: 4 }).score).toBe(100);
    expect(evolutionScore({ englishSkills: [40], stepsGiven: 0, stepsDone: 0 }).score).toBe(40);
    expect(evolutionScore({ englishSkills: [], stepsGiven: 0, stepsDone: 0 }).score).toBeNull();
  });
});

describe("goalsReport", () => {
  it("counts active goals by area, step completion and the most common goals", () => {
    const report = goalsReport(
      [
        { id: "a", userId: "u1", title: "Guardar R$ 300 por mês", area: "money", archived: false },
        { id: "b", userId: "u2", title: "guardar r$ 300  por mês", area: "money", archived: false },
        { id: "c", userId: "u2", title: "Caminhar", area: "health", archived: false },
        { id: "d", userId: "u3", title: "Ler mais", area: "other", archived: true },
      ],
      [
        { goalId: "a", done: true },
        { goalId: "a", done: false },
        { goalId: "c", done: true },
        { goalId: "d", done: true },
      ],
    );
    expect(report.students).toBe(2);
    expect(report.activeGoals).toBe(3);
    expect(report.byArea[0]).toEqual({
      area: "money",
      goals: 2,
      percent: 67,
      stepsGiven: 2,
      stepsDone: 1,
      donePercent: 50,
    });
    expect(report.byArea.find((row) => row.area === "english")?.donePercent).toBeNull();
    expect(report.topTitles[0]).toEqual({ title: "Guardar R$ 300 por mês", count: 2 });
  });
});

describe("plusGoalWeek", () => {
  const step = (goalId: string, day: string, done: boolean) => ({
    goalId,
    day,
    doneAt: done ? `${day}T15:00:00Z` : null,
  });

  it("lists the last 7 days ending today and counts the days done", () => {
    const week = plusGoalWeek(
      [step("g", "2026-10-09", true), step("g", "2026-10-07", true), step("x", "2026-10-08", true)],
      "g",
      "2026-10-09",
    );
    expect(week.days.map((d) => d.day)).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    expect(week.doneCount).toBe(2);
    expect(week.streak).toBe(1);
  });

  it("keeps the run going while today's step is still open", () => {
    const steps = [
      step("g", "2026-10-07", true),
      step("g", "2026-10-08", true),
      step("g", "2026-10-09", false),
    ];
    expect(plusGoalWeek(steps, "g", "2026-10-09").streak).toBe(2);
    expect(
      plusGoalWeek([...steps.slice(0, 2), step("g", "2026-10-09", true)], "g", "2026-10-09").streak,
    ).toBe(3);
  });

  it("starts at zero for a new goal", () => {
    expect(plusGoalWeek([], "g", "2026-10-09")).toMatchObject({ doneCount: 0, streak: 0 });
  });
});

describe("plusScoreProgress", () => {
  it("counts only active-goal steps from the first score day through today", () => {
    const progress = plusScoreProgress(
      [
        { goalId: "active", day: "2026-10-01", doneAt: "2026-10-01T12:00:00Z" },
        { goalId: "active", day: "2026-10-02", doneAt: null },
        { goalId: "active", day: "2026-10-15", doneAt: "2026-10-15T12:00:00Z" },
        { goalId: "active", day: "2026-10-16", doneAt: "2026-10-16T12:00:00Z" },
        { goalId: "archived", day: "2026-10-15", doneAt: "2026-10-15T12:00:00Z" },
      ],
      new Set(["active"]),
      "2026-10-02",
      "2026-10-15",
    );

    expect(progress).toEqual({ stepsGiven: 2, stepsDone: 1 });
  });

  it("returns zero when there are no eligible steps", () => {
    expect(plusScoreProgress([], new Set(["active"]), "2026-10-02", "2026-10-15")).toEqual({
      stepsGiven: 0,
      stepsDone: 0,
    });
  });
});

describe("evolutionScoreComposition", () => {
  it("splits the score equally when both dimensions are measured", () => {
    expect(evolutionScoreComposition({ english: 80, goals: 60 })).toEqual({
      mode: "balanced",
      englishWeight: 50,
      goalsWeight: 50,
      englishContribution: 40,
      goalsContribution: 30,
    });
  });

  it("gives the only measured dimension the full weight", () => {
    expect(evolutionScoreComposition({ english: 72, goals: null })).toMatchObject({
      mode: "english_only",
      englishWeight: 100,
      goalsWeight: null,
      englishContribution: 72,
      goalsContribution: null,
    });
    expect(evolutionScoreComposition({ english: null, goals: 45 })).toMatchObject({
      mode: "goals_only",
      englishWeight: null,
      goalsWeight: 100,
      englishContribution: null,
      goalsContribution: 45,
    });
  });

  it("does not invent contributions when neither dimension is measured", () => {
    expect(evolutionScoreComposition({ english: null, goals: null })).toEqual({
      mode: "empty",
      englishWeight: null,
      goalsWeight: null,
      englishContribution: null,
      goalsContribution: null,
    });
  });
});

describe("evolutionScoreSkillContribution", () => {
  it("splits the English dimension equally across measured skills", () => {
    expect(
      evolutionScoreSkillContribution({
        skillScore: 80,
        measuredSkillCount: 4,
        englishWeight: 50,
      }),
    ).toBe(10);
  });

  it("uses the full score weight when English is the only measured dimension", () => {
    expect(
      evolutionScoreSkillContribution({
        skillScore: 80,
        measuredSkillCount: 4,
        englishWeight: 100,
      }),
    ).toBe(20);
  });

  it("does not invent a contribution for unmeasured or unavailable skills", () => {
    expect(
      evolutionScoreSkillContribution({
        skillScore: null,
        measuredSkillCount: 4,
        englishWeight: 50,
      }),
    ).toBeNull();
    expect(
      evolutionScoreSkillContribution({
        skillScore: 80,
        measuredSkillCount: 0,
        englishWeight: 50,
      }),
    ).toBeNull();
    expect(
      evolutionScoreSkillContribution({
        skillScore: 80,
        measuredSkillCount: 4,
        englishWeight: null,
      }),
    ).toBeNull();
  });
});



describe("Evolution Score end-to-end validation", () => {
  it("keeps the balanced score consistent with its displayed contributions", () => {
    const score = evolutionScore({
      englishSkills: [80, 60, null, 85],
      stepsGiven: 8,
      stepsDone: 6,
    });
    const composition = evolutionScoreComposition(score);

    expect(score).toEqual({ score: 75, english: 75, goals: 75 });
    expect(composition.englishContribution).toBe(37.5);
    expect(composition.goalsContribution).toBe(37.5);
    expect((composition.englishContribution ?? 0) + (composition.goalsContribution ?? 0)).toBe(
      score.score,
    );
  });

  it("rounds measured skill averages and goal completion using the same score contract", () => {
    expect(
      evolutionScore({ englishSkills: [70, 71], stepsGiven: 3, stepsDone: 2 }),
    ).toEqual({ score: 69, english: 71, goals: 67 });
  });

  it("caps completed goal steps at the number of eligible steps", () => {
    expect(
      evolutionScore({ englishSkills: [], stepsGiven: 4, stepsDone: 7 }),
    ).toEqual({ score: 100, english: null, goals: 100 });
  });

  it("ignores unavailable and non-finite skill measurements without fabricating data", () => {
    expect(
      evolutionScore({
        englishSkills: [null, Number.NaN, Number.POSITIVE_INFINITY],
        stepsGiven: 0,
        stepsDone: 0,
      }),
    ).toEqual({ score: null, english: null, goals: null });
  });

  it("does not count future, expired-window, or archived-goal steps in the score input", () => {
    const progress = plusScoreProgress(
      [
        { goalId: "active", day: "2026-10-01", doneAt: "2026-10-01T12:00:00Z" },
        { goalId: "active", day: "2026-10-02", doneAt: null },
        { goalId: "active", day: "2026-10-16", doneAt: "2026-10-16T12:00:00Z" },
        { goalId: "archived", day: "2026-10-10", doneAt: "2026-10-10T12:00:00Z" },
      ],
      new Set(["active"]),
      "2026-10-02",
      "2026-10-15",
    );

    expect(progress).toEqual({ stepsGiven: 1, stepsDone: 0 });
    expect(evolutionScore({ englishSkills: [], ...progress })).toEqual({
      score: 0,
      english: null,
      goals: 0,
    });
  });

  it("keeps an unavailable score distinct from a measured zero score", () => {
    expect(evolutionScore({ englishSkills: [], stepsGiven: 0, stepsDone: 0 }).score).toBeNull();
    expect(evolutionScore({ englishSkills: [0], stepsGiven: 0, stepsDone: 0 }).score).toBe(0);
    expect(evolutionScore({ englishSkills: [], stepsGiven: 2, stepsDone: 0 }).score).toBe(0);
  });
});
