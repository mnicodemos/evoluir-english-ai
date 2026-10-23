import { describe, expect, it } from "vitest";

import {
  finalTestUnlockedAt,
  finalTestUnlockedPush,
  goalStepsLinePt,
  countDueReviews,
  lifeTasksLinePt,
  lifeTasksReminder,
  shownReviewCount,
  studyReminder,
  wordOfDayBody,
} from "@/lib/reviewReminder";

const now = new Date("2026-10-06T12:00:00Z");

describe("vocabulary review reminder", () => {
  it("counts only due, not fully mastered words, capped at the daily review limit", () => {
    const states = [
      { mastery_level: 20, next_review_at: "2026-10-05T12:00:00Z" },
      { mastery_level: 40, next_review_at: "2026-10-07T12:00:00Z" },
      { mastery_level: 100, next_review_at: "2026-10-01T12:00:00Z" },
      { mastery_level: 0, next_review_at: null },
    ];
    expect(countDueReviews(states, now)).toBe(1);
    expect(shownReviewCount(37)).toBe(10);
  });

  it("adds the reviews to the word of the day only when there are any", () => {
    expect(wordOfDayBody("melhorar — to make better", 0)).toBe("melhorar — to make better");
    expect(wordOfDayBody("melhorar — to make better", 1)).toBe(
      "melhorar — to make better · 🔁 1 palavra para revisar hoje",
    );
  });

  it("points the evening reminder to Vocabulary when reviews are waiting", () => {
    expect(studyReminder(0).path).toBe("/dashboard");
    const withReviews = studyReminder(3);
    expect(withReviews.path).toBe("/vocabulary");
    expect(withReviews.body).toContain("3 palavras para revisar");
  });

  it("puts the study plan's day in the pushes and opens the plan", () => {
    const task = { title: "Listening Lab", status: "today" as const };
    expect(wordOfDayBody("melhorar — to make better", 0, "", task)).toBe(
      "melhorar — to make better · 📅 Hoje no plano: Listening Lab",
    );
    const reminder = studyReminder(2, { title: "Unit 2 Final Test", status: "missed" });
    expect(reminder.path).toBe("/study-plan");
    expect(reminder.body).toContain("Recupere no plano: Unit 2 Final Test");
    expect(reminder.body).toContain("2 palavras para revisar");
  });
});

describe("Life+ AI tasks in the pushes", () => {
  it("counts the open tasks of the day", () => {
    expect(lifeTasksLinePt(0)).toBe("");
    expect(lifeTasksLinePt(1)).toBe("📝 1 tarefa do Life+ AI para hoje");
    expect(lifeTasksLinePt(3)).toBe("📝 3 tarefas do Life+ AI para hoje");
  });

  it("reminds the open tasks once the study day is done", () => {
    expect(lifeTasksReminder(2)).toMatchObject({ path: "/life" });
    expect(lifeTasksReminder(2).body).toContain("2 tarefas");
  });
});

describe("reminders added on 2026-10-23", () => {
  it("names the goal steps still open", () => {
    expect(goalStepsLinePt(0)).toBe("");
    expect(goalStepsLinePt(1)).toContain("Falta 1 passo");
    expect(goalStepsLinePt(3)).toContain("Faltam 3 passos");
  });

  it("finds when the Final Test opened, whatever the order of completions", () => {
    const done = ["2026-10-20T10:00:00Z", "2026-10-22T09:00:00Z", "2026-10-21T08:00:00Z"];
    expect(finalTestUnlockedAt(done, 3)).toBe(Date.parse("2026-10-22T09:00:00Z"));
    expect(finalTestUnlockedAt(done, 2)).toBe(Date.parse("2026-10-21T08:00:00Z"));
    expect(finalTestUnlockedAt(done, 4)).toBeNull();
  });

  it("announces the Final Test and the next level", () => {
    expect(finalTestUnlockedPush("b1", 21)).toMatchObject({
      title: "🏁 Prova Final liberada!",
      path: "/learning",
    });
    expect(finalTestUnlockedPush("b1", 21).body).toContain("suba para o B2");
    expect(finalTestUnlockedPush("c2", 21).body).toContain("conclua o nível");
  });
});
