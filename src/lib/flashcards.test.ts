import { describe, expect, it } from "vitest";

import { isFlashcardDue, lessonStarted, reversedCard } from "./flashcards";

const card = { card_type: "word", translation: "casa" };

describe("flashcard direction", () => {
  it("asks every other card from Portuguese at A1-A2", () => {
    expect(reversedCard(card, 0, "A1")).toBe(false);
    expect(reversedCard(card, 1, "a2")).toBe(true);
    expect(reversedCard(card, 3, "A1")).toBe(true);
  });

  it("keeps English on the front from B1, for listen cards and without a translation", () => {
    expect(reversedCard(card, 1, "B1")).toBe(false);
    expect(reversedCard({ ...card, card_type: "listen" }, 1, "A1")).toBe(false);
    expect(reversedCard({ ...card, translation: " " }, 1, "A1")).toBe(false);
    expect(reversedCard(card, 1, null)).toBe(false);
  });
});

describe("isFlashcardDue (one rule for the count and the deck)", () => {
  const started = new Set(["lesson-a"]);
  const today = "2026-10-31";
  it("counts never-rated cards of opened lessons and cards whose date arrived", () => {
    expect(isFlashcardDue({ id: "1", lesson_id: "lesson-a" }, undefined, started, today)).toBe(
      true,
    );
    expect(
      isFlashcardDue(
        { id: "2", lesson_id: "lesson-b" },
        { next_review_date: "2026-10-30" },
        started,
        today,
      ),
    ).toBe(true);
    expect(
      isFlashcardDue(
        { id: "3", lesson_id: "lesson-a" },
        { next_review_date: "2026-11-02" },
        started,
        today,
      ),
    ).toBe(false);
  });
  it("leaves out cards of lessons not opened yet", () => {
    expect(isFlashcardDue({ id: "4", lesson_id: "lesson-b" }, undefined, started, today)).toBe(
      false,
    );
    expect(lessonStarted({ video_progress: 0, progress: 0, completed_at: null })).toBe(false);
    expect(lessonStarted({ video_progress: 0, progress: 10, completed_at: null })).toBe(true);
  });
});
