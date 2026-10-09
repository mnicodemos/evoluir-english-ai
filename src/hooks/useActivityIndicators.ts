import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { useLessonRound } from "@/hooks/useLessonRound";
import { useRoundStart, useSavedPractice } from "@/hooks/usePracticeSync";
import { useProfile } from "@/hooks/useProfile";
import { fetchUserVocabularyMastery } from "@/hooks/useUserVocabularyMastery";
import { supabase } from "@/integrations/supabase/client";
import {
  LISTENING_COMPLETION_KEY,
  LISTENING_TRACK_ID,
  listeningHasNewActivity,
  readJson,
  readText,
  vocabularyGenerationFailureKey,
  vocabularyGenerationRecentlyFailed,
  vocabularyIndicatorVisible,
  WRITING_DONE_ROUND_PREFIX,
  writeText,
  writingHasNewActivity,
} from "@/lib/activityIndicators";
import { lessonBatchKey, VOCABULARY_BATCH_SIZE } from "@/lib/vocabularyBatch";
import { dailyWords } from "@/lib/vocabularyPlan.functions";
import { vocabularySingleFlight } from "@/lib/vocabularySingleFlight";
import { roundPrompts, WRITING_CATEGORIES, writingLevelConfig } from "@/lib/writingLevels";
import { studyDayStartIso, studyToday } from "@/lib/today";

/** One recovery attempt per lesson round per page load. */
const recoveryAttempts = new Set<string>();
const retryCounts = new Map<string, number>();

export type ActivityIndicators = {
  listening: boolean;
  writing: boolean;
  vocabulary: boolean;
  /** False until today's practice (saved work, round, vocabulary batch) has loaded. */
  ready: boolean;
};

/**
 * The current vocabulary batch and how much of it the student has mastered.
 * Both come from existing state: the batch rows in `vocabulary` (same batch key
 * the Vocabulary page uses) and `user_vocabulary` mastery.
 */
function useVocabularyBatchProgress(
  round: number,
  userId: string | undefined,
  level: string | undefined,
) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["vocabulary-batch-progress", userId, round, level],
    enabled: !!userId && !!level,
    // Words may be saved after the lesson screen closed (the server finishes the
    // batch on its own), so an empty batch is re-read until its words appear.
    refetchInterval: (query) =>
      query.state.data && query.state.data.batchWordIds.length === 0 ? 15_000 : false,
    queryFn: async () => {
      if (!userId) return { batchWordIds: [], masteryByWordId: {} };
      const [batch, mine] = await Promise.all([
        supabase
          .from("vocabulary")
          .select("id")
          .eq("created_by", userId)
          .eq("batch_key", lessonBatchKey(round))
          .eq("level", level ?? ""),
        fetchUserVocabularyMastery(queryClient),
      ]);
      if (batch.error) throw batch.error;
      const masteryByWordId: Record<string, number> = {};
      for (const row of mine) masteryByWordId[row.word_id] = row.mastery_level ?? 0;
      return { batchWordIds: (batch.data ?? []).map((w) => w.id), masteryByWordId };
    },
  });
}

/**
 * Which dashboard areas have something new for this student. Everything is read
 * from the state those areas already keep — no new storage, no notifications.
 */
export function useActivityIndicators(): ActivityIndicators {
  const { data: profile } = useProfile();
  const { data: lessonRound } = useLessonRound();
  const round = lessonRound ?? 0;
  const {
    data: vocabularyBatch,
    isPending: vocabularyLoading,
    isFetching: vocabularyFetching,
    isError: vocabularyError,
  } = useVocabularyBatchProgress(round, profile?.id, profile?.level);
  const [indicators, setIndicators] = useState<ActivityIndicators>({
    listening: false,
    writing: false,
    vocabulary: false,
    ready: false,
  });

  // A finished lesson whose words were never saved (e.g. the lesson screen was
  // closed mid-request) asks for them once, reusing the same Vocabulary request.
  const generateVocabulary = useServerFn(dailyWords);
  const queryClient = useQueryClient();
  // Bumped to re-check when a previous request is still holding the AI slot or a
  // brief failure pause expires (e.g. the lesson request was cut off by leaving
  // the page, which leaves its slot busy for a few minutes).
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (!profile || round < 1 || !vocabularyBatch || vocabularyFetching || vocabularyError) return;
    // A full batch has ten words; a partial one (the model repeated known
    // words) is completed once, the same way an empty one is.
    if (vocabularyBatch.batchWordIds.length >= VOCABULARY_BATCH_SIZE) return;
    const failureKey = vocabularyGenerationFailureKey(profile.id, round);
    const attemptKey = `${profile.id}:${round}`;
    const scheduleRetry = (ms: number) => {
      const attempts = (retryCounts.get(attemptKey) ?? 0) + 1;
      retryCounts.set(attemptKey, attempts);
      if (attempts > 12) return;
      window.setTimeout(() => {
        recoveryAttempts.delete(attemptKey);
        setRetryTick((n) => n + 1);
      }, ms);
    };
    if (recoveryAttempts.has(attemptKey)) return;
    if (vocabularyGenerationRecentlyFailed(readText(failureKey))) {
      recoveryAttempts.add(attemptKey);
      scheduleRetry(60_000);
      return;
    }
    recoveryAttempts.add(attemptKey);
    vocabularySingleFlight(profile.id, () => generateVocabulary({ data: { level: profile.level } }))
      .then((words) => {
        // Still short of ten (the model ran out of new words): wait before the
        // next attempt instead of calling the AI on every Dashboard visit.
        writeText(failureKey, words.length < VOCABULARY_BATCH_SIZE ? String(Date.now()) : "");
        if (words.length > 0)
          void queryClient.invalidateQueries({ queryKey: ["vocabulary-batch-progress"] });
      })
      .catch((error: unknown) => {
        // A request already holding the slot is not a failure: check again shortly.
        const busy = error instanceof Error && /already running|wait|busy/i.test(error.message);
        if (!busy) writeText(failureKey, String(Date.now()));
        scheduleRetry(busy ? 60_000 : 90_000);
      });
  }, [
    profile,
    round,
    vocabularyBatch,
    vocabularyFetching,
    vocabularyError,
    generateVocabulary,
    queryClient,
    retryTick,
  ]);

  const roundStart = useRoundStart();
  const { data: savedPractice } = useSavedPractice();

  useEffect(() => {
    if (!profile) return;
    const completion = readJson<Record<string, number>>(LISTENING_COMPLETION_KEY, {});
    const config = writingLevelConfig(profile.level);
    const signature = `${studyToday()}-${config.level}-${round}`;

    // Same round boundary the Writing page uses, so tasks corrected on any
    // device of this account turn the dot off everywhere.
    const cutoff = [studyDayStartIso(), roundStart ?? ""].sort().at(-1)!;
    const serverDone = (savedPractice?.writing ?? [])
      .filter((w) => w.at >= cutoff)
      .map((w) => w.prompt);
    const serverBefore = [
      ...new Set((savedPractice?.writing ?? []).filter((w) => w.at < cutoff).map((w) => w.prompt)),
    ];
    const prompts =
      savedPractice && roundStart !== undefined ? roundPrompts(config, round, serverBefore) : [];
    const done = [
      ...new Set([
        ...readJson<string[]>(`${WRITING_DONE_ROUND_PREFIX}${signature}`, []),
        ...serverDone,
      ]),
    ];

    setIndicators({
      ready:
        savedPractice !== undefined &&
        roundStart !== undefined &&
        !vocabularyLoading &&
        !vocabularyFetching,
      // Same rule as the Listening page: a listening saved after the round
      // began counts as done on every device of this account.
      listening:
        !(
          roundStart !== undefined &&
          (savedPractice?.listening ?? []).some((at) => !roundStart || at > roundStart)
        ) &&
        listeningHasNewActivity({
          round,
          completedRound: completion[LISTENING_TRACK_ID] ?? null,
        }),
      writing: writingHasNewActivity({
        prompts,
        done,
        tasksPerRound: WRITING_CATEGORIES.length,
      }),
      vocabulary: vocabularyIndicatorVisible({
        batch: vocabularyBatch,
        isLoading: vocabularyLoading || vocabularyFetching,
        isError: vocabularyError,
        generationFailed: vocabularyGenerationRecentlyFailed(
          readText(vocabularyGenerationFailureKey(profile.id, round)),
        ),
      }),
    });
  }, [
    profile,
    round,
    roundStart,
    savedPractice,
    vocabularyBatch,
    vocabularyError,
    vocabularyFetching,
    vocabularyLoading,
  ]);

  return indicators;
}
