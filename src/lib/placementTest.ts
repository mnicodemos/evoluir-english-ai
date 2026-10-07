import { LEVELS, findLevel, type LevelInfo } from "@/lib/level";

type Band = (typeof LEVELS)[number]["value"];

/** The student hears a sentence (text-to-speech) and picks what it means. */
export type ListeningQuestion = {
  id: string;
  kind: "listen";
  /** CEFR band this question belongs to. */
  band: Band;
  /** Sentence spoken aloud; shown as text only if the audio cannot play. */
  audio: string;
  prompt: string;
  options: string[];
  answer: string;
};

/** The student types the missing words; any accepted spelling scores. */
export type WritingQuestion = {
  id: string;
  kind: "write";
  band: Band;
  prompt: string;
  /** Sentence with "___" where the typed answer goes. */
  sentence: string;
  accepted: string[];
};

export type PlacementQuestion = ListeningQuestion | WritingQuestion;

/** One listening and one writing question per CEFR band, from A1 to C2. */
export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "a1-listen",
    kind: "listen",
    band: "a1",
    audio: "Hello! My name is Anna. I am from Brazil.",
    prompt: "Where is Anna from?",
    options: ["Spain", "Brazil", "Italy", "Canada"],
    answer: "Brazil",
  },
  {
    id: "a1-write",
    kind: "write",
    band: "a1",
    prompt: "Write the missing word (verb to be).",
    sentence: "She ___ a teacher.",
    accepted: ["is"],
  },
  {
    id: "a2-listen",
    kind: "listen",
    band: "a2",
    audio: "I usually take the bus to work, but yesterday I walked because it was sunny.",
    prompt: "How did the speaker get to work yesterday?",
    options: ["By bus", "By car", "On foot", "By train"],
    answer: "On foot",
  },
  {
    id: "a2-write",
    kind: "write",
    band: "a2",
    prompt: "Write the past of the verb go.",
    sentence: "Yesterday we ___ to the cinema.",
    accepted: ["went"],
  },
  {
    id: "b1-listen",
    kind: "listen",
    band: "b1",
    audio:
      "I'd love to come to the party, but I've got an exam on Monday, so I'd better stay home and study.",
    prompt: "Why won't the speaker go to the party?",
    options: ["They have to work", "They weren't invited", "They are sick", "They need to study"],
    answer: "They need to study",
  },
  {
    id: "b1-write",
    kind: "write",
    band: "b1",
    prompt: "Complete with the verb work in the right tense.",
    sentence: "I ___ in this company since 2019.",
    accepted: ["have worked", "'ve worked", "have been working", "'ve been working"],
  },
  {
    id: "b2-listen",
    kind: "listen",
    band: "b2",
    audio:
      "Had the flight not been delayed, we would have made it to the conference in time for the keynote.",
    prompt: "What happened?",
    options: [
      "They arrived early for the keynote",
      "They missed the keynote because of the delay",
      "The keynote was cancelled",
      "They chose a later flight",
    ],
    answer: "They missed the keynote because of the delay",
  },
  {
    id: "b2-write",
    kind: "write",
    band: "b2",
    prompt: "Complete with the verb call.",
    sentence: "If I had known about the delay, I ___ you earlier.",
    accepted: ["would have called", "would've called", "'d have called"],
  },
  {
    id: "c1-listen",
    kind: "listen",
    band: "c1",
    audio:
      "Frankly, the new policy is a far cry from what we were promised. It barely scratches the surface of the problem.",
    prompt: "What does the speaker think of the policy?",
    options: [
      "It is exactly what was promised",
      "It solves the problem",
      "It does much less than expected",
      "It goes too far",
    ],
    answer: "It does much less than expected",
  },
  {
    id: "c1-write",
    kind: "write",
    band: "c1",
    prompt: "Write the one missing word.",
    sentence: "Hardly ___ we started the presentation when the system crashed.",
    accepted: ["had"],
  },
  {
    id: "c2-listen",
    kind: "listen",
    band: "c2",
    audio:
      "Notwithstanding the board's assurances, investors remained unconvinced, and the share price languished for months.",
    prompt: "What does the speaker say?",
    options: [
      "Investors trusted the board",
      "The share price rose quickly",
      "Investors doubted the board and the shares stayed low",
      "The board gave no assurances",
    ],
    answer: "Investors doubted the board and the shares stayed low",
  },
  {
    id: "c2-write",
    kind: "write",
    band: "c2",
    prompt: "Complete the expression (an indirect but obvious criticism).",
    sentence: "The minister's remarks were a thinly ___ criticism of the policy.",
    accepted: ["veiled"],
  },
];

/** Lowercase, straight apostrophes, single spaces, no surrounding punctuation. */
export function normalizeWritten(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[.,!?;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectAnswer(question: PlacementQuestion, answer: string | undefined): boolean {
  if (!answer || answer === DONT_KNOW) return false;
  if (question.kind === "listen") return answer === question.answer;
  const typed = normalizeWritten(answer);
  return question.accepted.some((accepted) => normalizeWritten(accepted) === typed);
}

/** Stored when the student taps "I don't know": answered, and never correct. */
export const DONT_KNOW = "__dont_know__";

/** A question counts as answered once a choice is made or something was typed. */
export function isAnswered(answer: string | undefined): boolean {
  return Boolean(answer?.trim());
}

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
      correct: questions.filter((q) => isCorrectAnswer(q, answers[q.id])).length,
    };
  });

  let index = 0;
  for (let i = 0; i < byBand.length; i++) {
    if (byBand[i]!.correct >= 1) index = i;
    else break;
  }
  const level = findLevel(bands[index]);

  return {
    level,
    correct: byBand.reduce((sum, b) => sum + b.correct, 0),
    total: PLACEMENT_QUESTIONS.length,
    byBand,
  };
}

/**
 * The test can end before the last question: the level is the highest band
 * passed without skipping one, so once a band has both questions answered and
 * none right, the harder bands can no longer change the result. A beginner
 * is not made to type C2 answers.
 */
export function placementComplete(answers: Record<string, string>): boolean {
  for (const band of LEVELS.map((l) => l.value)) {
    const questions = PLACEMENT_QUESTIONS.filter((q) => q.band === band);
    if (!questions.every((q) => isAnswered(answers[q.id]))) return false;
    if (!questions.some((q) => isCorrectAnswer(q, answers[q.id]))) return true;
  }
  return true;
}
