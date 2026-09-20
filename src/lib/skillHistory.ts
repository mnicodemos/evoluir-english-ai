export type SkillResultRow = {
  skill: string;
  score: number | null;
  assessed_at: string;
};

export const SKILL_SERIES = [
  "Listening",
  "Reading",
  "Talking",
  "Writing",
  "Grammar",
  "Vocabulary",
] as const;

export type SkillSeries = (typeof SKILL_SERIES)[number];

const SKILL_TO_SERIES: Record<string, SkillSeries> = {
  listening: "Listening",
  reading: "Reading",
  speaking: "Talking",
  talking: "Talking",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
};

export type SkillHistoryPoint = { name: string; date: string } & Partial<
  Record<SkillSeries, number | null>
>;

/**
 * Builds the real historical series per skill: for each day, the last assessed
 * score of that day. Days without a new assessment keep the last known state
 * (the value still in force), and no value is invented before the first
 * assessment of a skill.
 */
export function buildSkillHistory(
  rows: SkillResultRow[],
  days: { label: string; date: string }[],
): { data: SkillHistoryPoint[]; series: SkillSeries[] } {
  const latest = new Map<string, { at: number; score: number }>();

  for (const row of rows) {
    const series = SKILL_TO_SERIES[row.skill?.toLowerCase?.() ?? ""];
    if (!series) continue;
    if (typeof row.score !== "number" || Number.isNaN(row.score)) continue;
    const at = new Date(row.assessed_at).getTime();
    if (Number.isNaN(at)) continue;
    const date = new Date(row.assessed_at).toISOString().slice(0, 10);
    const key = `${date}|${series}`;
    const current = latest.get(key);
    if (!current || at >= current.at) {
      latest.set(key, { at, score: Math.round(row.score) });
    }
  }

  const carried = new Map<SkillSeries, number>();
  const present = new Set<SkillSeries>();

  const data = days.map((day) => {
    const point: SkillHistoryPoint = { name: day.label, date: day.date };
    for (const series of SKILL_SERIES) {
      const found = latest.get(`${day.date}|${series}`);
      if (found) {
        carried.set(series, found.score);
        present.add(series);
      }
      point[series] = carried.has(series) ? carried.get(series)! : null;
    }
    return point;
  });

  return { data, series: SKILL_SERIES.filter((s) => present.has(s)) };
}
