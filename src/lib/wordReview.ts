/**
 * One word review for the student (owner request, 2026-10-30: Vocabulary's
 * words and the lessons' flashcards were two review queues, two counts and two
 * doors). The Dashboard, the bell and the phone pill show one count, both
 * kinds together, and one door: Vocabulary while it has words due (its page
 * then leads to the cards), else the cards' review. Each kind keeps its own
 * spaced ladder underneath (user_vocabulary, user_flashcards).
 */
export function wordReviewTarget(
  wordsDue: number,
  cardsDue: number,
): { total: number; to: "/vocabulary" | "/learning/review" } {
  return {
    total: Math.max(0, wordsDue) + Math.max(0, cardsDue),
    to: wordsDue > 0 || cardsDue <= 0 ? "/vocabulary" : "/learning/review",
  };
}
