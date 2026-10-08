import { describe, expect, it } from "vitest";

import {
  evolutionScore,
  fallbackPlusStep,
  guessPlusArea,
  parsePlusSteps,
  plusDayComplete,
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
