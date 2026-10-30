import { describe, expect, it } from "vitest";

import { reversedCard } from "./flashcards";

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
