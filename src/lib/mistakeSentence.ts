/**
 * "My mistakes" shows the whole sentence the student wrote, with only the
 * wrong part marked (user request). The saved mistake keeps the wrong phrase;
 * the sentence is found again in the student's own Writing texts.
 */
export type MistakeSentence = { before: string; wrong: string; after: string };

function sentencesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The first sentence (newest text first) that contains the wrong phrase,
 * split around it with the student's own casing. Null when the phrase is not
 * found or already is the whole sentence (nothing to add around it).
 */
export function findMistakeSentence(original: string, texts: string[]): MistakeSentence | null {
  const phrase = original.replace(/\s+/g, " ").trim();
  if (!phrase) return null;
  const needle = phrase.toLowerCase();
  for (const text of texts) {
    for (const sentence of sentencesOf(text)) {
      const at = sentence.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      const before = sentence.slice(0, at);
      const after = sentence.slice(at + phrase.length);
      if (!before.trim() && !after.replace(/[.!?]/g, "").trim()) return null;
      return { before, wrong: sentence.slice(at, at + phrase.length), after };
    }
  }
  return null;
}
