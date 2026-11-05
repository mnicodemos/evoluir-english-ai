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
/** Words unlocked by each completed lesson. */
export const VOCABULARY_BATCH_SIZE = 10;

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


export type LessonTemplateRow = {
  curriculum_key: string;
  content: unknown;
};

export type TemplateVocabularyWord = {
  word: string;
  translation: string;
  meaning: string;
  pronunciation: string;
  example: string;
  lesson_title: string;
  difficulty: string;
};

/**
 * Extracts complete vocabulary candidates from shared lesson templates.
 * Incomplete flashcards are ignored; the caller can fill any remaining slots with AI.
 */
export function templateVocabularyCandidates(
  templates: LessonTemplateRow[],
  lessonTitles: Map<string, string>,
): TemplateVocabularyWord[] {
  const candidates: TemplateVocabularyWord[] = [];
  const seen = new Set<string>();

  for (const template of templates) {
    const content =
      template.content && typeof template.content === "object"
        ? (template.content as Record<string, unknown>)
        : null;
    const flashcards = Array.isArray(content?.["flashcards"]) ? content["flashcards"] : [];
    const lessonTitle = lessonTitles.get(template.curriculum_key) ?? "";

    for (const item of flashcards) {
      if (!item || typeof item !== "object") continue;
      const card = item as Record<string, unknown>;
      const word = typeof card["word"] === "string" ? card["word"].trim() : "";
      const translation =
        typeof card["translation"] === "string" ? card["translation"].trim() : "";
      const meaning = typeof card["definition"] === "string" ? card["definition"].trim() : "";
      const example = typeof card["example"] === "string" ? card["example"].trim() : "";
      const key = word.toLowerCase();

      if (!word || !translation || !meaning || !example || seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        word,
        translation,
        meaning,
        pronunciation:
          typeof card["pronunciation"] === "string" ? card["pronunciation"].trim() : "",
        example,
        lesson_title: lessonTitle,
        difficulty:
          card["difficulty"] === "easy" || card["difficulty"] === "hard"
            ? card["difficulty"]
            : "medium",
      });
    }
  }

  return candidates;
}
