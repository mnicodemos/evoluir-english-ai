export function normalizeListeningWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Existing Listening Lab bag-of-words rule, shared by client display and server authority. */
export function listeningAnswerScore(expected: string, answer: string) {
  const target = normalizeListeningWords(expected);
  const pool = [...normalizeListeningWords(answer)];
  let hits = 0;
  for (const word of target) {
    const index = pool.indexOf(word);
    if (index >= 0) {
      hits += 1;
      pool.splice(index, 1);
    }
  }
  return target.length ? Math.round((hits / target.length) * 100) : 0;
}

const normalizePronunciation = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();

/** Existing normalized Levenshtein rule, shared by client display and server authority. */
export function pronunciationSimilarity(target: string, spoken: string): number {
  const a = normalizePronunciation(target);
  const b = normalizePronunciation(spoken);
  if (!a || !b) return 0;
  if (b === a || b.split(/\s+/).includes(a)) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, index) => [
    index,
    ...Array<number>(cols - 1).fill(0),
  ]);
  for (let column = 0; column < cols; column += 1) dist[0]![column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < cols; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      dist[row]![column] = Math.min(
        dist[row - 1]![column]! + 1,
        dist[row]![column - 1]! + 1,
        dist[row - 1]![column - 1]! + cost,
      );
    }
  }
  return Math.max(0, 1 - dist[rows - 1]![cols - 1]! / Math.max(a.length, b.length));
}
