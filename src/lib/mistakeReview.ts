/**
 * Spaced review for "My mistakes". Pure rules shared by the server (which
 * decides) and the page (which only displays), so they can be tested.
 */

/** Days until the next review after a correct answer at each step (0..4). */
export const MISTAKE_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
/** A mistake corrected at every step is mastered. */
export const MISTAKE_MASTERED_STEP = MISTAKE_INTERVAL_DAYS.length;

const DAY_MS = 86_400_000;

/** Lower case, straight quotes, no punctuation, single spaces. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
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
 * The student's correction counts when it matches the expected phrase,
 * ignoring case and punctuation and allowing one small typo per ~20 letters.
 */
export function isCorrectAnswer(answer: string, expected: string): boolean {
  const a = normalizeAnswer(answer);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const allowed = Math.floor(b.length / 20);
  return allowed > 0 && editDistance(a, b) <= allowed;
}

/** Where the mistake goes after an answer: up one step, or back to the start. */
export function nextMistakeReview(step: number, correct: boolean, now = new Date()) {
  if (!correct) {
    return { step: 0, nextReviewAt: new Date(now.getTime() + DAY_MS).toISOString() };
  }
  const current = Math.max(0, Math.min(step, MISTAKE_MASTERED_STEP - 1));
  return {
    step: current + 1,
    nextReviewAt: new Date(now.getTime() + MISTAKE_INTERVAL_DAYS[current]! * DAY_MS).toISOString(),
  };
}

export function isMistakeDue(
  row: { review_step: number; next_review_at: string },
  now = new Date(),
): boolean {
  return row.review_step < MISTAKE_MASTERED_STEP && new Date(row.next_review_at) <= now;
}
