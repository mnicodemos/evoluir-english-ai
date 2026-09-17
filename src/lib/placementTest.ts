import { LEVELS, findLevel, type LevelInfo } from "@/lib/level";

export type PlacementQuestion = {
  id: string;
  /** CEFR band this question belongs to. */
  band: (typeof LEVELS)[number]["value"];
  prompt: string;
  options: string[];
  answer: string;
};

/** Two graded questions per CEFR band, from A1 to C2. */
export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "a1-1",
    band: "a1",
    prompt: "She ___ a teacher.",
    options: ["is", "are", "be", "am"],
    answer: "is",
  },
  {
    id: "a1-2",
    band: "a1",
    prompt: "I have two ___.",
    options: ["childs", "children", "childrens", "child"],
    answer: "children",
  },
  {
    id: "a2-1",
    band: "a2",
    prompt: "Yesterday we ___ to the cinema.",
    options: ["go", "gone", "went", "goes"],
    answer: "went",
  },
  {
    id: "a2-2",
    band: "a2",
    prompt: "There isn't ___ milk in the fridge.",
    options: ["many", "some", "a few", "any"],
    answer: "any",
  },
  {
    id: "b1-1",
    band: "b1",
    prompt: "I ___ in this company since 2019.",
    options: ["work", "have worked", "am working", "worked"],
    answer: "have worked",
  },
  {
    id: "b1-2",
    band: "b1",
    prompt: "If it rains tomorrow, we ___ the meeting online.",
    options: ["will hold", "would hold", "held", "hold would"],
    answer: "will hold",
  },
  {
    id: "b2-1",
    band: "b2",
    prompt: "The report ___ by the team before the deadline.",
    options: ["was finished", "has finish", "finished was", "is finish"],
    answer: "was finished",
  },
  {
    id: "b2-2",
    band: "b2",
    prompt: "If I had known about the delay, I ___ you earlier.",
    options: ["would call", "will have called", "would have called", "had called"],
    answer: "would have called",
  },
  {
    id: "c1-1",
    band: "c1",
    prompt: "Choose the most natural option: The proposal was turned ___ by the board.",
    options: ["down", "off", "over", "away"],
    answer: "down",
  },
  {
    id: "c1-2",
    band: "c1",
    prompt: "Hardly ___ the presentation when the system crashed.",
    options: ["we had started", "had we started", "we started", "did we started"],
    answer: "had we started",
  },
  {
    id: "c2-1",
    band: "c2",
    prompt: "Her argument was compelling, albeit ___ on questionable data.",
    options: ["predicated", "predicting", "predicament", "predictable"],
    answer: "predicated",
  },
  {
    id: "c2-2",
    band: "c2",
    prompt: "The minister's remarks were widely seen as a thinly ___ criticism of the policy.",
    options: ["veiled", "covered", "hidden away", "shaded"],
    answer: "veiled",
  },
];

export type PlacementResult = {
  level: LevelInfo;
  correct: number;
  total: number;
  /** Correct answers per CEFR band. */
  byBand: { band: string; correct: number; total: number }[];
};

/**
 * CEFR placement rule: a band is passed with at least one correct answer out of two.
 * The final level is the highest band passed without skipping a band.
 */
export function scorePlacement(answers: Record<string, string>): PlacementResult {
  const bands = LEVELS.map((l) => l.value);
  const byBand = bands.map((band) => {
    const questions = PLACEMENT_QUESTIONS.filter((q) => q.band === band);
    return {
      band,
      total: questions.length,
      correct: questions.filter((q) => answers[q.id] === q.answer).length,
    };
  });

  let index = 0;
  for (let i = 0; i < byBand.length; i++) {
    if (byBand[i]!.correct >= 1) index = i;
    else break;
  }
  // A perfect band unlocks the next one only when the following band was also passed.
  const level = findLevel(bands[index]);

  return {
    level,
    correct: byBand.reduce((sum, b) => sum + b.correct, 0),
    total: PLACEMENT_QUESTIONS.length,
    byBand,
  };
}
