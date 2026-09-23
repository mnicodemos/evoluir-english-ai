/**
 * Rules behind the small green dot on the dashboard cards.
 *
 * Nothing new is stored: the dot reads the state Listening Lab, Writing and
 * Vocabulary already keep. A dot only appears when the round that the student's
 * completed lessons unlocked has something left to do, and it disappears as soon
 * as that state says the round was consumed.
 */

export const LISTENING_COMPLETION_KEY = "listening-lab-completed-v1";
export const LISTENING_TRACK_ID = "everyday";
export const WRITING_HISTORY_ROUND_PREFIX = "writing-prompts-round-";
export const WRITING_DONE_ROUND_PREFIX = "writing-done-round-";

/** The Listening round is new until it is completed for this lesson count. */
export function listeningHasNewActivity(input: {
  round: number;
  completedRound: number | null | undefined;
}) {
  return input.completedRound !== input.round;
}

/** Writing is new while the current round still has an unanswered task. */
export function writingHasNewActivity(input: {
  prompts: string[];
  done: string[];
  tasksPerRound: number;
}) {
  if (input.prompts.length < input.tasksPerRound) return true;
  return input.prompts.some((prompt) => !input.done.includes(prompt));
}

/** Words a full vocabulary batch offers per round. */
export const VOCABULARY_BATCH_SIZE = 10;
/** A word counts as done with the same mastery threshold the Vocabulary page uses. */
export const VOCABULARY_MASTERED = 75;

/**
 * Vocabulary is new while the current round's batch still has a word the student
 * has not mastered, or while the batch is not complete yet (a new round unlocks
 * more words). Only the existing completion state (user_vocabulary mastery) is
 * used: merely opening the page changes nothing.
 */
export function vocabularyHasNewActivity(input: {
  batchWordIds: string[];
  masteryByWordId: Record<string, number>;
  batchSize?: number;
}) {
  const size = input.batchSize ?? VOCABULARY_BATCH_SIZE;
  if (input.batchWordIds.length < size) return true;
  return input.batchWordIds.some(
    (id) => (input.masteryByWordId[id] ?? 0) < VOCABULARY_MASTERED,
  );
}



/**
 * Whether an existing Dashboard destination still has an available action.
 * Only state that means the round was actually done is used: Listening keeps a
 * completed round and Writing keeps its corrected tasks. Vocabulary is judged by
 * real reviews, and opening an activity is not doing it, so it never hides a
 * recommendation. Lessons and open-ended practice stay available.
 */
export function dashboardActionAvailable(
  destination: string,
  indicators: { listening: boolean; writing: boolean; vocabulary: boolean },
) {
  if (destination === "/listening") return indicators.listening;
  if (destination === "/writing") return indicators.writing;
  return true;
}


function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function readText(key: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
