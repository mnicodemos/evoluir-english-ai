/**
 * After the Diamond (owner decision, 2026-10-31): no new jewels, but every
 * further 63 days in a row earns another Diamond cycle ("Diamond x2", "x3"),
 * granted only by the database (diamond_cycles, migration 0099).
 */
export const DIAMOND_DAYS = 63;

/** The Diamond level shown: 1 for the Diamond itself, else the highest cycle. */
export function diamondLevel(cycles: readonly number[]): number {
  return Math.max(1, ...cycles.filter((cycle) => Number.isInteger(cycle) && cycle >= 2));
}

/** "Diamond" or "Diamond ×3". */
export function diamondName(level: number, lang: "pt" | "en"): string {
  const name = lang === "pt" ? "Diamante" : "Diamond";
  return level >= 2 ? `${name} ×${level}` : name;
}

/** Days in a row still needed for the next cycle (it needs 63 × next in a row). */
export function daysToNextDiamond(level: number, streakDays: number): number {
  return Math.max(0, DIAMOND_DAYS * (level + 1) - Math.max(0, streakDays));
}

export type DiamondJourney = {
  level: number;
  streakDays: number;
  studyDays: number | null;
  conversations: number | null;
  wordsLearned: number | null;
  englishLevel: string | null;
};

/** The journey EVO sums up on the celebration, as a short brag to share. */
export function diamondShareText(journey: DiamondJourney, lang: "pt" | "en"): string {
  const pt = lang === "pt";
  const lines = [
    pt
      ? `💎 Conquistei o ${diamondName(journey.level, "pt")} no Evoluir+!`
      : `💎 I earned the ${diamondName(journey.level, "en")} on Evoluir+!`,
    pt
      ? `🔥 ${journey.streakDays} dias seguidos estudando inglês`
      : `🔥 ${journey.streakDays} days in a row studying English`,
    journey.studyDays != null
      ? pt
        ? `📅 ${journey.studyDays} dias de estudo no total`
        : `📅 ${journey.studyDays} study days in total`
      : null,
    journey.conversations
      ? pt
        ? `🗣️ ${journey.conversations} conversas com a EVO`
        : `🗣️ ${journey.conversations} conversations with EVO`
      : null,
    journey.wordsLearned
      ? pt
        ? `📚 ${journey.wordsLearned} palavras aprendidas`
        : `📚 ${journey.wordsLearned} words learned`
      : null,
    journey.englishLevel
      ? pt
        ? `🎯 Nível ${journey.englishLevel.toUpperCase()}`
        : `🎯 Level ${journey.englishLevel.toUpperCase()}`
      : null,
  ];
  return lines.filter(Boolean).join("\n");
}
