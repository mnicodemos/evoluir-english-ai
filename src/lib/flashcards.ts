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

/** A lesson the student opened or answered, whose cards join the review. */
export function lessonStarted(lesson: {
  video_progress: number | null;
  progress: number | null;
  completed_at: string | null;
}): boolean {
  return (lesson.video_progress ?? 0) > 0 || (lesson.progress ?? 0) > 0 || !!lesson.completed_at;
}
