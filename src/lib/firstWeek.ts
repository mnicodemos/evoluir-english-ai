/**
 * Guided first week: seven small steps that introduce a new student to the
 * app's main practices. A step is done from real evidence (what the student
 * actually did), never from a tick, so it cannot drift from the data.
 */

export type FirstWeekEvidence = {
  conversations: number;
  writings: number;
  lessonsCompleted: number;
  listenings: number;
  wordsReviewed: number;
  mistakesReviewed: number;
  joinedLeague: boolean;
};

export type FirstWeekStep = {
  day: number;
  title: string;
  hint: string;
  to: "/coach" | "/writing" | "/learning" | "/listening" | "/vocabulary" | "/mistakes" | "/league";
  done: (evidence: FirstWeekEvidence) => boolean;
};

export const FIRST_WEEK_STEPS: FirstWeekStep[] = [
  {
    day: 1,
    title: "First conversation with EVO",
    hint: "Talk by voice for a few minutes in AI Speaking.",
    to: "/coach",
    done: (e) => e.conversations > 0,
  },
  {
    day: 2,
    title: "Get a text corrected",
    hint: "Write a few sentences in Writing and see the correction.",
    to: "/writing",
    done: (e) => e.writings > 0,
  },
  {
    day: 3,
    title: "Finish a lesson",
    hint: "Watch, review and take the quiz of the next lesson on your path.",
    to: "/learning",
    done: (e) => e.lessonsCompleted > 0,
  },
  {
    day: 4,
    title: "Train your ear",
    hint: "Listen to and repeat sentences in Listening.",
    to: "/listening",
    done: (e) => e.listenings > 0,
  },
  {
    day: 5,
    title: "Review 10 words",
    hint: "Practise today's words in Vocabulary.",
    to: "/vocabulary",
    done: (e) => e.wordsReviewed >= 10,
  },
  {
    day: 6,
    title: "Review one of your mistakes",
    hint: "Fix a sentence in My mistakes.",
    to: "/mistakes",
    done: (e) => e.mistakesReviewed > 0,
  },
  {
    day: 7,
    title: "Join the weekly league",
    hint: "Compare your XP with students at your level.",
    to: "/league",
    done: (e) => e.joinedLeague,
  },
];

/** Days a new account keeps seeing the guide (unless it is completed first). */
export const FIRST_WEEK_VISIBLE_DAYS = 14;

export function firstWeekProgress(evidence: FirstWeekEvidence) {
  const steps = FIRST_WEEK_STEPS.map((step) => ({ ...step, isDone: step.done(evidence) }));
  const doneCount = steps.filter((step) => step.isDone).length;
  const next = steps.find((step) => !step.isDone) ?? null;
  return { steps, doneCount, total: steps.length, next };
}

export function showFirstWeek(
  createdAt: string | null | undefined,
  doneCount: number,
  now = new Date(),
) {
  if (!createdAt || doneCount >= FIRST_WEEK_STEPS.length) return false;
  const ageDays = (now.getTime() - new Date(createdAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= FIRST_WEEK_VISIBLE_DAYS;
}
