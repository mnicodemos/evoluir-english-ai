import { describe, expect, it } from "vitest";

import { isFlashcardDue, isFlashcardReviewed, lessonStarted, reversedCard, sessionCardState } from "./flashcards";

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

describe("sessionCardState (session ends at 10/10, the Again queue keeps showing)", () => {
  const cards = Array.from({ length: 10 }, (_, i) => ({ id: `c${i + 1}` }));

  it("shows the next main-deck card before the end", () => {
    const state = sessionCardState(cards, { index: 3, done: false }, []);
    expect(state.card?.id).toBe("c4");
    expect(state.relearning).toBe(false);
    expect(state.position).toBe(3);
  });

  it("shows no card when the last card is done and nothing waits in the Again queue", () => {
    const state = sessionCardState(cards, { index: 9, done: true }, []);
    expect(state.card).toBeUndefined();
    expect(state.relearning).toBe(false);
  });

  it("keeps the last card from coming back at 10/10, even with a stale index", () => {
    const state = sessionCardState(cards, { index: 9, done: true }, []);
    expect(state.inMainDeck).toBe(false);
    expect(state.card).toBeUndefined();
  });

  it("shows the next Again card once the main deck is done", () => {
    const state = sessionCardState(cards, { index: 9, done: true }, ["c2", "c7"]);
    expect(state.relearning).toBe(true);
    expect(state.card?.id).toBe("c2");
    expect(state.position).toBe(11);
  });

  it("ends the session only when the Again queue is empty", () => {
    expect(sessionCardState(cards, { index: 9, done: true }, ["c7"]).card?.id).toBe("c7");
    expect(sessionCardState(cards, { index: 9, done: true }, []).card).toBeUndefined();
  });

  it("restart state shows the first card again", () => {
    const state = sessionCardState(cards, { index: 0, done: false }, []);
    expect(state.card?.id).toBe("c1");
    expect(state.inMainDeck).toBe(true);
  });
});

describe("isFlashcardReviewed (new cards are not due reviews)", () => {
  it("excludes missing and zero-review states", () => {
    expect(isFlashcardReviewed(undefined)).toBe(false);
    expect(isFlashcardReviewed({ times_reviewed: 0 })).toBe(false);
    expect(isFlashcardReviewed({ times_reviewed: null })).toBe(false);
  });
  it("includes only cards the student has actually rated", () => {
    expect(isFlashcardReviewed({ times_reviewed: 1 })).toBe(true);
    expect(isFlashcardReviewed({ times_reviewed: 3 })).toBe(true);
  });
});
