/**
 * Lesson search on the learning path (user request, 2026-10-31): the level's
 * lessons whose title or unit title holds the words typed, ignoring case and
 * accents. Pure, so the rule is tested apart from the screen.
 */

/** Lower case without accents, so "licao" finds "lição" and "PAST" finds "past". */
export function foldText(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** The lessons matching the query, in path order; an empty query finds none. */
export function searchLessons<L extends { title: string; unitTitle: string }>(
  lessons: readonly L[],
  query: string,
): L[] {
  const needle = foldText(query.trim());
  if (!needle) return [];
  return lessons.filter((lesson) =>
    foldText(`${lesson.title} ${lesson.unitTitle}`).includes(needle),
  );
}
