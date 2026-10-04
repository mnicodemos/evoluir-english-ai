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
export const VOCABULARY_GENERATION_FAILED_PREFIX = "vocab-gen-failed:";

export function vocabularyGenerationFailureKey(userId: string, round: number) {
  return `${VOCABULARY_GENERATION_FAILED_PREFIX}${userId}:${round}`;
}

/** A failed generation pauses automatic retries only briefly, never forever. */
export const VOCABULARY_FAILURE_PAUSE_MS = 10 * 60_000;

/** Stored value is the failure timestamp; legacy "1" flags count as expired. */
export function vocabularyGenerationRecentlyFailed(raw: string | null, now = Date.now()) {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at < 1e12) return false;
  return now - at < VOCABULARY_FAILURE_PAUSE_MS;
}

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
 * Vocabulary is new only when the current round has at least one saved word that
 * the student has not mastered. An empty batch is not an available activity.
 */
export function vocabularyHasNewActivity(input: {
  batchWordIds: string[];
  masteryByWordId: Record<string, number>;
  batchSize?: number;
}) {
  if (input.batchWordIds.length === 0) return false;
  return input.batchWordIds.some((id) => (input.masteryByWordId[id] ?? 0) <= 0);
}

/**
 * Loading and failed reads never advertise vocabulary as available. Saved words
 * always win over an earlier generation failure: a retry (or another device)
 * may have saved the batch after the failure was noted.
 */
export function vocabularyIndicatorVisible(input: {
  batch: { batchWordIds: string[]; masteryByWordId: Record<string, number> } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  generationFailed?: boolean;
}) {
  if (input.isLoading || input.isError || !input.batch) return false;
  return vocabularyHasNewActivity(input.batch);
}

/**
 * Whether an existing Dashboard destination still has an available action.
 * Only state that means the round was actually done is used: Listening keeps a
 * completed round, Writing keeps its corrected tasks and Vocabulary keeps the
 * mastery of the current batch — so a recommendation is never shown for a
 * surface whose round has nothing left to practise. Opening a page is not doing
 * it. Lessons and open-ended practice stay available.
 */
export function dashboardActionAvailable(
  destination: string,
  indicators: { listening: boolean; writing: boolean; vocabulary: boolean },
) {
  if (destination === "/listening") return indicators.listening;
  if (destination === "/writing") return indicators.writing;
  if (destination === "/vocabulary") return indicators.vocabulary;
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
