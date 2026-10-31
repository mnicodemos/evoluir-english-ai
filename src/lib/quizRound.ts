/**
 * Question order of a lesson quiz round (owner request, 2026-10-30): the first
 * round keeps the lesson's order; each retake shuffles the questions (and,
 * in LessonQuiz, their options) with a seed of its own and puts the ones missed
 * last time first, so a student cannot pass by remembering positions.
 */

/** Same order every render for a seed, so a round never reshuffles under the student. */
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function quizRoundOrder<Q extends { id: string }>(
  questions: readonly Q[],
  lessonId: string,
  round: number,
  missedFirst: readonly string[],
): Q[] {
  if (round === 0) return [...questions];
  const shuffled = stableShuffle(questions, `${lessonId}:${round}`);
  return [
    ...shuffled.filter((q) => missedFirst.includes(q.id)),
    ...shuffled.filter((q) => !missedFirst.includes(q.id)),
  ];
}

/** The seed of a question's options: its id in the first round, then id and round. */
export function optionSeed(questionId: string, round: number) {
  return round === 0 ? questionId : `${questionId}:${round}`;
}
