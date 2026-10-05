import { describe, expect, it } from "vitest";

import {
  isWeeklyReportDay,
  leaguePositions,
  weekStartIso,
  weeklyReportMessage,
} from "./weeklyReport";

const base = {
  minutes: 0,
  activities: 0,
  lessons: 0,
  words: 0,
  mistakesReviewed: 0,
  streakDays: 0,
};

describe("weekly report", () => {
  it("runs on Sunday in São Paulo time", () => {
    // 22:00 UTC Sunday is 19:00 Sunday in São Paulo.
    expect(isWeeklyReportDay(new Date("2026-10-11T22:00:00Z"))).toBe(true);
    // 01:00 UTC Monday is still 22:00 Sunday in São Paulo.
    expect(isWeeklyReportDay(new Date("2026-10-12T01:00:00Z"))).toBe(true);
    expect(isWeeklyReportDay(new Date("2026-10-12T04:00:00Z"))).toBe(false);
  });

  it("covers seven study days ending today", () => {
    expect(weekStartIso(new Date("2026-10-11T22:00:00Z"))).toBe("2026-10-05T03:00:00.000Z");
  });

  it("summarises the week with singular and plural words", () => {
    const message = weeklyReportMessage({
      ...base,
      minutes: 95,
      activities: 6,
      lessons: 1,
      words: 12,
      mistakesReviewed: 3,
      streakDays: 5,
    });
    expect(message.body).toBe(
      "95 minutos · 1 lição · 12 palavras novas · 3 erros revisados. Streak de 5 dias 🔥",
    );
    expect(message.path).toBe("/progress");
  });

  it("invites an inactive student back to the plan", () => {
    const message = weeklyReportMessage(base);
    expect(message.path).toBe("/study-plan");
    expect(message.body).toContain("recomeçar");
  });

  it("ranks the league like the database, sharing ties", () => {
    const positions = leaguePositions([
      { id: "a", xp: 80 },
      { id: "b", xp: 100 },
      { id: "c", xp: 80 },
      { id: "d", xp: 50 },
    ]);
    expect([...["b", "a", "c", "d"].map((id) => positions.get(id))]).toEqual([1, 2, 2, 4]);
  });

  it("adds the final league position with a medal", () => {
    const message = weeklyReportMessage({
      ...base,
      minutes: 30,
      activities: 2,
      lessons: 1,
      league: { position: 2, total: 5, level: "b2" },
    });
    expect(message.body).toContain("Liga B2: 2º de 5 🥈. Nova semana começa amanhã!");
  });
});
