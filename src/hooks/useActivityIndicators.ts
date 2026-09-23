import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  LISTENING_COMPLETION_KEY,
  LISTENING_TRACK_ID,
  listeningHasNewActivity,
  readJson,
  vocabularyHasNewActivity,
  WRITING_DONE_ROUND_PREFIX,
  WRITING_HISTORY_ROUND_PREFIX,
  writingHasNewActivity,
} from "@/lib/activityIndicators";
import { studyToday } from "@/lib/today";
import { WRITING_CATEGORIES, writingLevelConfig } from "@/lib/writingLevels";

export type ActivityIndicators = {
  listening: boolean;
  writing: boolean;
  vocabulary: boolean;
};

/** Same day key the Writing page uses for its round signature. */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The current vocabulary batch and how much of it the student has mastered.
 * Both come from existing state: the batch rows in `vocabulary` (same batch key
 * the Vocabulary page uses) and `user_vocabulary` mastery.
 */
function useVocabularyBatchProgress(round: number, userId: string | undefined) {
  return useQuery({
    queryKey: ["vocabulary-batch-progress", userId, round],
    enabled: !!userId,
    queryFn: async () => {
      const [batch, mine] = await Promise.all([
        supabase
          .from("vocabulary")
          .select("id")
          .eq("created_by", userId!)
          .eq("batch_key", lessonBatchKey(round)),
        supabase.from("user_vocabulary").select("word_id, mastery_level"),
      ]);
      if (batch.error) throw batch.error;
      if (mine.error) throw mine.error;
      const masteryByWordId: Record<string, number> = {};
      for (const row of mine.data ?? []) masteryByWordId[row.word_id] = row.mastery_level ?? 0;
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
  const { data: vocabularyBatch } = useVocabularyBatchProgress(round, profile?.id);
  const [indicators, setIndicators] = useState<ActivityIndicators>({
    listening: false,
    writing: false,
    vocabulary: false,
  });

  useEffect(() => {
    if (!profile) return;
    const completion = readJson<Record<string, number>>(LISTENING_COMPLETION_KEY, {});
    const config = writingLevelConfig(profile.level);
    const signature = `${todayKey()}-${config.level}-${round}`;

    setIndicators({
      listening: listeningHasNewActivity({
        round,
        completedRound: completion[LISTENING_TRACK_ID] ?? null,
      }),
      writing: writingHasNewActivity({
        prompts: readJson<string[]>(`${WRITING_HISTORY_ROUND_PREFIX}${signature}`, []),
        done: readJson<string[]>(`${WRITING_DONE_ROUND_PREFIX}${signature}`, []),
        tasksPerRound: WRITING_CATEGORIES.length,
      }),
      vocabulary: vocabularyBatch
        ? vocabularyHasNewActivity(vocabularyBatch)
        : false,
    });
  }, [profile, round, vocabularyBatch]);


  return indicators;
}
