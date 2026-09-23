import type { QueryClient } from "@tanstack/react-query";

/**
 * Data that changes when the student finishes an activity (writing, talking,
 * quiz, unit/final test). Content catalogues (lessons, flashcards, vocabulary
 * catalogue, dictionary) are NOT listed here: they do not change, so refetching
 * them only delays the screen.
 */
export const ACTIVITY_REFRESH_KEYS = [
  ["profile"],
  ["study-snapshot"],
  ["next-step"],
  ["proof-of-progress"],
  ["quiz-results"],
  ["user-lessons"],
  ["lesson-round"],
  ["learning-profile"],
  ["activities-recent"],
  ["progress-latest"],
  ["progress-history"],
  ["skill-history"],
  ["overall-average"],
  ["minutes-today"],
  ["minutes-by-day"],
  ["weekly-frequency"],
  ["study-frequency"],
] as const;

/** Data that depends on the CEFR level the student is studying. */
export const LEVEL_REFRESH_KEYS = [
  ["profile"],
  ["study-snapshot"],
  ["next-step"],
  ["proof-of-progress"],
  ["lesson-round"],
  ["user-lessons"],
  ["progress-latest"],
  ["progress-history"],
  ["skill-history"],
  ["overall-average"],
  ["daily-words"],
  ["vocabulary-progress"],
  ["vocabulary-batch-progress"],
  ["study-plan"],
  ["minutes-by-day"],
] as const;

function invalidateAll(queryClient: QueryClient, keys: readonly readonly string[][]) {
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  );
}

/** Refreshes exactly what a finished activity can change. */
export function refreshAfterActivity(queryClient: QueryClient) {
  return invalidateAll(queryClient, ACTIVITY_REFRESH_KEYS);
}

/** Refreshes exactly what a level change can change. */
export function refreshAfterLevelChange(queryClient: QueryClient) {
  return invalidateAll(queryClient, LEVEL_REFRESH_KEYS);
}
