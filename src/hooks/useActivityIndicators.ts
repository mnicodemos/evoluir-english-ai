import { useEffect, useState } from "react";

import { useLessonRound } from "@/hooks/useLessonRound";
import { useProfile } from "@/hooks/useProfile";
import {
  LISTENING_COMPLETION_KEY,
  LISTENING_TRACK_ID,
  listeningHasNewActivity,
  readJson,
  readText,
  VOCABULARY_SEEN_KEY,
  vocabularyHasNewActivity,
  vocabularySignature,
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
 * Which dashboard areas have something new for this student. Everything is read
 * from the state those areas already keep — no new storage, no notifications.
 */
export function useActivityIndicators(): ActivityIndicators {
  const { data: profile } = useProfile();
  const { data: lessonRound } = useLessonRound();
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
        signature: vocabularySignature(studyToday(), round),
        seenSignature: readText(VOCABULARY_SEEN_KEY),
      }),
    });
  }, [profile, round]);

  return indicators;
}
