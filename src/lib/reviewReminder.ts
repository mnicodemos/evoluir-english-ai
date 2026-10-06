import { DAILY_REVIEW_LIMIT, isDue, type ReviewState } from "@/lib/vocabularyReview";

/**
 * Due vocabulary reviews, capped at what the Vocabulary page brings back in a
 * day (DAILY_REVIEW_LIMIT), so a reminder never promises more than it shows.
 */
export function shownReviewCount(due: number): number {
  return Math.max(0, Math.min(due, DAILY_REVIEW_LIMIT));
}

export function countDueReviews(states: ReviewState[], now = new Date()): number {
  return shownReviewCount(states.filter((state) => isDue(state, now)).length);
}

/** "1 palavra para revisar" / "3 palavras para revisar" (push copy is Portuguese). */
export function reviewWordsPt(count: number): string {
  return count === 1 ? "1 palavra para revisar" : `${count} palavras para revisar`;
}

/** Morning word-of-the-day body, with the due reviews when there are any. */
export function wordOfDayBody(base: string, due: number, extra = ""): string {
  const shown = shownReviewCount(due);
  const reviews = shown ? ` · 🔁 ${reviewWordsPt(shown)} hoje` : "";
  return `${base}${reviews}${extra}`.slice(0, 280);
}

/** Evening reminder for a student who has not met today's goal yet. */
export function studyReminder(due: number): { title: string; body: string; path: string } {
  const shown = shownReviewCount(due);
  if (!shown) {
    return {
      title: "Hora de estudar inglês 📚",
      body: "Você ainda não completou sua meta de hoje. Faça uma atividade rápida e mantenha seu Streak!",
      path: "/dashboard",
    };
  }
  return {
    title: "Hora de estudar inglês 📚",
    body: `Você tem ${reviewWordsPt(shown)}. Uma revisão rápida ajuda a cumprir a meta de hoje e manter seu Streak!`,
    path: "/vocabulary",
  };
}
