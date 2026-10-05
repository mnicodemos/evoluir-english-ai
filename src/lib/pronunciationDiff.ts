/**
 * "Pronunciation by sound": aligns the target word with what was heard, letter
 * by letter, so the student sees which part came out different instead of only
 * a percentage. Display only; the score itself stays pronunciationSimilarity.
 */

export type LetterMatch = { char: string; ok: boolean };

const letters = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/**
 * The part of the transcript that best matches the target: a single word or
 * two neighbours joined ("note book" for "notebook").
 */
export function closestHeard(target: string, spoken: string): string {
  const goal = letters(target);
  const words = spoken
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z'-]/g, ""))
    .filter(Boolean);
  const candidates = [...words, ...words.slice(1).map((word, i) => `${words[i]} ${word}`)];
  let best = words[0] ?? "";
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(goal, letters(candidate));
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

/** Marks each letter of the target as heard (ok) or not, via the edit alignment. */
export function alignLetters(target: string, heard: string): LetterMatch[] {
  const a = letters(target);
  const b = letters(heard);
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1)
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  const ok = Array<boolean>(a.length).fill(false);
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && dp[i]![j] === dp[i - 1]![j - 1]) {
      ok[i - 1] = true;
      i -= 1;
      j -= 1;
    } else if (dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      i -= 1;
      j -= 1;
    } else if (dp[i]![j] === dp[i - 1]![j]! + 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  // Map back onto the original spelling; spaces, hyphens and apostrophes stay neutral.
  let index = 0;
  return [...target].map((char) =>
    /[a-z]/i.test(char) ? { char, ok: ok[index++] ?? false } : { char, ok: true },
  );
}

/** Consecutive letters that were not heard, e.g. ["th", "gh"]. */
export function missedParts(matches: LetterMatch[]): string[] {
  const parts: string[] = [];
  let current = "";
  for (const { char, ok } of matches) {
    if (!ok) current += char;
    else if (current) {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts;
}
