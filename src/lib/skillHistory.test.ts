import { describe, expect, it } from "vitest";

import { buildSkillHistory } from "./skillHistory";

const days = [
  { label: "18 Sep", date: "2026-09-18" },
  { label: "19 Sep", date: "2026-09-19" },
  { label: "20 Sep", date: "2026-09-20" },
];

describe("buildSkillHistory", () => {
  it("keeps the last assessed value of each day per skill", () => {
    const { data, series } = buildSkillHistory(
      [
        { skill: "grammar", score: 63, assessed_at: "2026-09-18T12:00:00.000Z" },
        { skill: "grammar", score: 67, assessed_at: "2026-09-19T10:00:00.000Z" },
        { skill: "grammar", score: 68, assessed_at: "2026-09-19T22:00:00.000Z" },
        { skill: "grammar", score: 64, assessed_at: "2026-09-20T15:00:00.000Z" },
      ],
      days,
    );
    expect(series).toEqual(["Grammar"]);
    expect(data.map((d) => d.Grammar)).toEqual([63, 68, 64]);
  });

  it("carries the value in force forward but invents nothing before the first assessment", () => {
    const { data } = buildSkillHistory(
      [{ skill: "writing", score: 79, assessed_at: "2026-09-19T13:00:00.000Z" }],
      days,
    );
    expect(data.map((d) => d.Writing)).toEqual([null, 79, 79]);
  });

  it("omits skills without any real history and maps speaking to Talking", () => {
    const { series } = buildSkillHistory(
      [{ skill: "speaking", score: 70, assessed_at: "2026-09-20T13:00:00.000Z" }],
      days,
    );
    expect(series).toEqual(["Talking"]);
  });

  it("ignores rows without a numeric score", () => {
    const { data, series } = buildSkillHistory(
      [{ skill: "vocabulary", score: null, assessed_at: "2026-09-19T13:00:00.000Z" }],
      days,
    );
    expect(series).toEqual([]);
    expect(data.every((d) => d.Vocabulary === null)).toBe(true);
  });
});
