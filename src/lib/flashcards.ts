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

/**
 * The lesson cards of today's review, one rule for the count and the deck
 * (owner report, 2026-10-31: the Dashboard said 80 to review and the deck held
 * 114, since the count left out cards never rated): a card of a lesson the
 * student opened (or one already rated) that was never rated, or whose review
 * date has arrived.
 */
export function isFlashcardDue(
  card: { id: string; lesson_id: string | null },
  state: { next_review_date: string } | undefined,
  startedLessonIds: ReadonlySet<string>,
  today: string,
): boolean {
  const unlocked = !card.lesson_id || startedLessonIds.has(card.lesson_id) || Boolean(state);
  if (!unlocked) return false;
  return !state || state.next_review_date <= today;
}

/**
 * Which card the deck shows, one rule for the card, the counter and the
 * finished state (owner report: at 10/10 the last card stayed on screen,
 * since the selection looked only at the Again queue, not at `done`): a
 * finished session shows the next Again card while the queue has one, and no
 * card at all once the queue is empty.
 */
export function sessionCardState<T extends { id: string }>(
  cards: ReadonlyArray<T>,
  saved: { index: number; done: boolean },
  again: readonly string[],
) {
  const index = Math.min(saved.index, Math.max(0, cards.length - 1));
  const inMainDeck = !saved.done && index < cards.length;
  const relearning = !inMainDeck && again.length > 0;
  const card = relearning
    ? cards.find((item) => item.id === again[0])
    : inMainDeck
      ? cards[index]
      : undefined;
  const position = relearning ? cards.length + 1 : index;
  return { index, inMainDeck, relearning, card, position };
}

/** A lesson the student opened or answered, whose cards join the review. */
export function lessonStarted(lesson: {
  video_progress: number | null;
  progress: number | null;
  completed_at: string | null;
}): boolean {
  return (lesson.video_progress ?? 0) > 0 || (lesson.progress ?? 0) > 0 || !!lesson.completed_at;
}

/** True only after the student has actually rated a flashcard at least once. */
export function isFlashcardReviewed(
  state: { times_reviewed?: number | null } | undefined,
): boolean {
  return (state?.times_reviewed ?? 0) > 0;
}
