import { DAYS_PER_LEAGUE } from "@/components/LeagueBadge";

/**
 * English levels follow the CEFR ladder: A1 → A2 → B1 → B2 → C1 → C2.
 * Lessons the student creates are always written for the current CEFR level.
 */
export const LEVELS = [
  {
    value: "a1",
    label: "A1 Beginner",
    cefr: "CEFR A1",
    hint: "Basic words, greetings and very short sentences",
    descriptor:
      "CEFR A1: very simple everyday expressions, present simple, basic vocabulary, short sentences, no idioms.",
  },
  {
    value: "a2",
    label: "A2 Elementary",
    cefr: "CEFR A2",
    hint: "Simple routines, past and future basics",
    descriptor:
      "CEFR A2: routine topics, past simple and going to, simple connectors, high-frequency vocabulary, short dialogues.",
  },
  {
    value: "b1",
    label: "B1 Intermediate",
    cefr: "CEFR B1",
    hint: "Everyday conversation and familiar work topics",
    descriptor:
      "CEFR B1: familiar topics, opinions and plans, present perfect, conditionals 0-1, common phrasal verbs.",
  },
  {
    value: "b2",
    label: "B2 Upper-Intermediate",
    cefr: "CEFR B2",
    hint: "Fluent discussion, meetings and detailed opinions",
    descriptor:
      "CEFR B2: abstract topics, argument and nuance, passive voice, conditionals 2-3, collocations and natural idioms.",
  },
  {
    value: "c1",
    label: "C1 Advanced",
    cefr: "CEFR C1",
    hint: "Nuance, idioms and complex professional language",
    descriptor:
      "CEFR C1: complex texts, implicit meaning, advanced idioms, register control, sophisticated linking.",
  },
  {
    value: "c2",
    label: "C2 Proficient",
    cefr: "CEFR C2",
    hint: "Near-native precision and style",
    descriptor:
      "CEFR C2: precise, subtle and stylistic language, rare idioms, nuance of connotation and tone.",
  },
] as const;

/** Older profiles stored broad levels; map them onto the CEFR ladder. */
const LEGACY_LEVELS: Record<string, string> = {
  basic: "a1",
  beginner: "a1",
  elementary: "a2",
  intermediate: "b1",
  "upper-intermediate": "b2",
  advanced: "c1",
  proficient: "c2",
};

export const TOTAL_LEAGUES = 10;
/** Days needed to close the last league (Diamond). Leagues are motivational only. */
export const DAYS_TO_LEVEL_UP = TOTAL_LEAGUES * DAYS_PER_LEAGUE;
/** Minimum score in the Final Test required to move up one CEFR level. */
export const FINAL_TEST_PASS = 70;
/** How many questions the Final Test of every level has. */
export const FINAL_TEST_QUESTIONS = 30;

export type LevelInfo = (typeof LEVELS)[number];

export type LevelState = {
  /** The level stored on the profile. */
  chosen: LevelInfo;
  /** The level used for new lessons (same as the stored one). */
  current: LevelInfo;
  /** The next CEFR step, when there is one. */
  next: LevelInfo | null;
  isMaxLevel: boolean;
};

export function findLevel(value: string | null | undefined): LevelInfo {
  const normalized = String(value ?? "").toLowerCase();
  const mapped = LEGACY_LEVELS[normalized] ?? normalized;
  return LEVELS.find((l) => l.value === mapped) ?? LEVELS[2];
}

/** The CEFR step above the given level, or null at C2. */
export function nextLevel(value: string | null | undefined): LevelInfo | null {
  const index = LEVELS.indexOf(findLevel(value));
  return index >= LEVELS.length - 1 ? null : LEVELS[index + 1]!;
}

/**
 * The student's level only changes when the Final Test of the level is passed
 * with 70% or more, so the state here simply reflects the stored level.
 */
export function getLevelState(chosenLevel: string | null | undefined): LevelState {
  const chosen = findLevel(chosenLevel);
  const next = nextLevel(chosen.value);
  return { chosen, current: chosen, next, isMaxLevel: next === null };
}
