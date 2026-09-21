/**
 * Pure helpers for the daily vocabulary batch.
 * Kept separate from the server function so the rules can be tested directly.
 */

export type SuggestedWord = {
  word?: string;
  translation?: string;
  [key: string]: unknown;
};

/** A new batch is unlocked by each completed lesson, so retaking one never creates a new batch. */
export function lessonBatchKey(completedLessons: number) {
  return `completed-${completedLessons}`;
}

/** Words the student already owns at this level, lower-cased for comparison. */
export function ownedWordSet(words: { word: string }[]) {
  return new Set(words.map((w) => w.word.trim().toLowerCase()));
}

/**
 * Keeps only suggestions that are new for THIS student at this level.
 * Words that merely exist in the global catalogue (samples, other students) are allowed.
 * Returns fewer than `limit` when that is all that is available — it never pads the list.
 */
export function selectNewWords<T extends SuggestedWord>(
  suggestions: T[],
  owned: Set<string>,
  limit: number,
): T[] {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const candidate of suggestions) {
    if (picked.length >= limit) break;
    const word = String(candidate.word ?? "").trim();
    const key = word.toLowerCase();
    if (!word || !candidate.translation) continue;
    if (owned.has(key) || seen.has(key)) continue;
    seen.add(key);
    picked.push(candidate);
  }
  return picked;
}
