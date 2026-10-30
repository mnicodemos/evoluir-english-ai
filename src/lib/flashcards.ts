import type { Flashcard } from "@/hooks/useLearning";

/**
 * Whether a card asks from Portuguese to English: at A1-A2, every other card
 * with a translation (owner request, 2026-10-30: recalling an English
 * definition stalls beginners, and producing the word trains speaking).
 */
export function reversedCard(
  card: Pick<Flashcard, "card_type" | "translation">,
  position: number,
  level?: string | null,
) {
  const beginner = ["a1", "a2"].includes(String(level ?? "").toLowerCase());
  return (
    beginner && card.card_type !== "listen" && !!card.translation?.trim() && position % 2 === 1
  );
}
