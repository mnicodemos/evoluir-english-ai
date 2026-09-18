import { findLevel } from "@/lib/level";

/**
 * CEFR adaptation for the Listening Lab and its pronunciation drills.
 * Nothing here touches the voice provider: the sentence pool, the accepted
 * sentence length and the playback rate are chosen per level, and the audio is
 * still produced by the existing speech route.
 */
export type ListeningLevelConfig = {
  level: string;
  label: string;
  /** Shortest accepted drill, in words. */
  minWords: number;
  /** Longest accepted drill, in words. */
  maxWords: number;
  /** Playback rate applied to the generated audio (1 = natural speed). */
  rate: number;
  /** Pronunciation goal shown discreetly under the header. */
  focus: string;
  /** Slow practice mode that fits the level. */
  slowMode: "word-by-word" | "slow-sentence";
  sentences: string[];
};

const CONFIGS: Record<string, ListeningLevelConfig> = {
  a1: {
    level: "a1",
    label: "A1",
    minWords: 3,
    maxWords: 6,
    rate: 0.75,
    focus: "Basic sounds and very frequent words, one short sentence at a time.",
    slowMode: "word-by-word",
    sentences: [
      "My name is Ana.",
      "I live in Sao Paulo.",
      "This is my family.",
      "She is my sister.",
      "I have two brothers.",
      "It is seven o'clock.",
      "I get up at six.",
      "I work every morning.",
      "My phone number is nine.",
      "I like coffee and bread.",
      "Nice to meet you.",
      "I study English every day.",
    ],
  },
  a2: {
    level: "a2",
    label: "A2",
    minWords: 5,
    maxWords: 8,
    rate: 0.85,
    focus: "Frequent words and simple past, repeated in short phrases.",
    slowMode: "word-by-word",
    sentences: [
      "I went to the beach yesterday.",
      "We bought two tickets this morning.",
      "She travelled to Portugal last year.",
      "The hotel was near the station.",
      "How much does this shirt cost?",
      "I paid with my credit card.",
      "We arrived late because of traffic.",
      "I visited my grandmother on Sunday.",
      "Can I try this jacket on?",
      "The train left ten minutes ago.",
      "We stayed there for one week.",
      "I ordered chicken and a salad.",
    ],
  },
  b1: {
    level: "b1",
    label: "B1",
    minWords: 8,
    maxWords: 12,
    rate: 0.95,
    focus: "Complete sentences with natural rhythm and clear word endings.",
    slowMode: "slow-sentence",
    sentences: [
      "I think we should finish this report before Friday.",
      "She has worked in this company for three years.",
      "If I have time tonight, I will review the numbers.",
      "The meeting was useful, but it took too long.",
      "I would rather discuss the budget in person.",
      "We are trying to understand why sales dropped.",
      "My manager asked me to prepare a short summary.",
      "I have already sent the files you asked for.",
      "It depends on how many people join the project.",
      "Could you explain that idea in simpler words?",
      "They decided to postpone the launch until next month.",
      "I am getting used to working from home.",
    ],
  },
  b2: {
    level: "b2",
    label: "B2",
    minWords: 8,
    maxWords: 14,
    rate: 1,
    focus: "Full sentences, sentence stress and connected speech.",
    slowMode: "slow-sentence",
    sentences: [
      "I get up early every morning.",
      "Let's grab a coffee after work.",
      "She lives near the train station.",
      "I forgot my keys at home.",
      "We are having dinner outside tonight.",
      "It looks like rain this afternoon.",
      "Could you send me the report?",
      "We must call the client today.",
      "The deadline moved to next month.",
      "Let's schedule a quick call tomorrow.",
      "Where is the gate for Lisbon?",
      "I have a reservation for tonight.",
      "Is breakfast included in the price?",
      "My luggage did not arrive today.",
    ],
  },
  c1: {
    level: "c1",
    label: "C1",
    minWords: 12,
    maxWords: 18,
    rate: 1,
    focus: "Fluency and accent reduction across longer, complex sentences.",
    slowMode: "slow-sentence",
    sentences: [
      "Had we anticipated the delay, we would have renegotiated the contract earlier.",
      "The findings suggest a correlation that the previous study failed to address.",
      "Despite considerable investment, the initiative has yet to deliver measurable results.",
      "I would argue that the proposal underestimates the operational risk involved.",
      "What concerns the board most is the lack of a contingency plan.",
      "The report highlights structural issues that go well beyond this quarter.",
      "She managed to reframe the discussion without dismissing anyone's contribution.",
      "Our recommendation is to phase the rollout across three separate regions.",
      "It is worth noting that the data was collected under unusual conditions.",
      "The committee agreed to revisit the criteria once the audit is complete.",
    ],
  },
  c2: {
    level: "c2",
    label: "C2",
    minWords: 12,
    maxWords: 20,
    rate: 1,
    focus: "Natural delivery, subtle stress and near-native intonation.",
    slowMode: "slow-sentence",
    sentences: [
      "To be fair, the argument holds up only if you accept its rather convenient premise.",
      "He has a knack for saying almost nothing while sounding perfectly authoritative.",
      "The proposal is elegant on paper, yet it quietly ignores every practical constraint.",
      "I wouldn't go so far as to call it a failure, but it certainly missed the mark.",
      "There is a fine line between confidence and wilful disregard for the evidence.",
      "Whatever the motivation, the outcome speaks rather louder than the intention.",
      "She conceded the point without ever giving up the substance of her position.",
      "It strikes me as a solution in search of a problem worth solving.",
      "The nuance here is easily lost in translation, and that is precisely the risk.",
      "For all its ambition, the plan rests on assumptions nobody has tested.",
    ],
  },
};

export function listeningLevelConfig(level: string | null | undefined): ListeningLevelConfig {
  const info = findLevel(level);
  return CONFIGS[info.value] ?? CONFIGS["b2"]!;
}

export function countWords(sentence: string) {
  return sentence.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

/** Keeps drills inside the word range of the level. */
export function fitsLevel(sentence: string, config: ListeningLevelConfig) {
  const total = countWords(sentence);
  return total >= config.minWords && total <= config.maxWords;
}

/** Breaks lesson text into drill candidates for the level. */
export function sentencesFromText(text: string, config: ListeningLevelConfig) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z]/.test(part) && fitsLevel(part, config));
}

/**
 * Picks the drills for one round. The level pool comes first, lesson sentences
 * of the same level are added, and the rotation offset keeps recent practice
 * from repeating the same sentences.
 */
export function pickListeningSentences(options: {
  config: ListeningLevelConfig;
  lessonSentences?: string[];
  rotation?: number;
  count?: number;
}): string[] {
  const { config, lessonSentences = [], rotation = 0, count = 3 } = options;
  const pool = [
    ...new Set(
      [...config.sentences, ...lessonSentences].filter((sentence) => fitsLevel(sentence, config)),
    ),
  ];
  if (pool.length === 0) return [];
  const start = ((rotation * count) % pool.length + pool.length) % pool.length;
  const picked: string[] = [];
  for (let index = 0; index < Math.min(count, pool.length); index += 1) {
    picked.push(pool[(start + index) % pool.length]!);
  }
  return picked;
}
