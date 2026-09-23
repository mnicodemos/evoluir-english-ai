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
 * Last time the student actually reviewed a vocabulary word. Read from the
 * existing user_vocabulary state; nothing new is stored.
 */
function useLastVocabularyReview() {
  return useQuery({
    queryKey: ["vocabulary-last-review"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("last_reviewed_at")
        .not("last_reviewed_at", "is", null)
        .order("last_reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.last_reviewed_at ?? null;
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
  const { data: lastVocabularyReview } = useLastVocabularyReview();
  const round = lessonRound ?? 0;
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
      vocabulary: vocabularyHasNewActivity({
        day: studyToday(),
        lastReviewedAt: lastVocabularyReview,
      }),
    });
  }, [profile, round, lastVocabularyReview]);

  return indicators;
}
