// Reading is measured by the daily reading only (user decision, 2026-10-17).
// current_skill_profile still holds the last Reading result built from lesson
// quizzes for students who have not finished a daily reading yet; every reader
// of that view drops it until the student has real Reading evidence.

type EvidenceCounter = {
  from: (table: "assessment_evidence") => {
    select: (
      columns: string,
      options: { count: "exact"; head: true },
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (column: string, value: string) => PromiseLike<{ count: number | null }>;
        };
      };
    };
  };
};

/** True when the student has Reading evidence from a daily reading. */
export async function hasDailyReadingEvidence(db: unknown, userId: string): Promise<boolean> {
  const { count } = await (db as EvidenceCounter)
    .from("assessment_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("skill", "reading")
    .eq("source_type", "reading");
  return (count ?? 0) > 0;
}

/** The skill rows without Reading while it has no daily reading behind it. */
export function withoutUnmeasuredReading<T extends { skill: string | null }>(
  rows: readonly T[],
  readingMeasured: boolean,
): T[] {
  return rows.filter((row) => row.skill !== "reading" || readingMeasured);
}
