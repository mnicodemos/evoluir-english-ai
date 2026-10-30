/** The skills of a lesson quiz, in the order they are listed. */
const SKILL_LABEL: Record<string, string> = { grammar: "Grammar", vocabulary: "Vocabulary" };

export type QuizSkillRow = {
  skill: string;
  label: string;
  right: number;
  total: number;
  /** Under 70% right: shown as what to review. */
  weak: boolean;
};

/**
 * Right answers by skill for the quiz result (owner request, 2026-10-30): the
 * score alone did not say what to review. Questions without a known skill are
 * left out; a skill is weak under 70% right.
 */
export function quizSkillSummary(
  items: readonly { skill: string | null; right: boolean }[],
): QuizSkillRow[] {
  return Object.keys(SKILL_LABEL).flatMap((skill) => {
    const mine = items.filter((item) => item.skill === skill);
    if (!mine.length) return [];
    const right = mine.filter((item) => item.right).length;
    return [
      {
        skill,
        label: SKILL_LABEL[skill]!,
        right,
        total: mine.length,
        weak: right / mine.length < 0.7,
      },
    ];
  });
}
