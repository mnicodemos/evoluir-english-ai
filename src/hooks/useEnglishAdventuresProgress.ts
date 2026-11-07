import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import {
  addStudySeconds,
  englishAdventureProgress,
  markActivityComplete,
  readCompletedActivities,
  readStudySeconds,
  saveCompletedAdventure,
} from "@/lib/englishAdventuresProgress";

export function useEnglishAdventuresProgress() {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const [ids, setIds] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!userId) {
      setIds([]);
      setSeconds(0);
      return;
    }
    const sync = () => {
      setIds(readCompletedActivities(userId));
      setSeconds(readStudySeconds(userId));
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [userId]);

  const markCompleted = useCallback((adventureId: string) => {
    if (!userId) return;
    saveCompletedAdventure(userId, adventureId);
    setIds(readCompletedActivities(userId));
  }, [userId]);

  const markActivityCompleted = useCallback((activityId: string) => {
    if (!userId) return;
    setIds(markActivityComplete(userId, activityId));
  }, [userId]);

  const recordStudySeconds = useCallback((elapsed: number) => {
    if (!userId || elapsed <= 0) return;
    setSeconds(addStudySeconds(userId, elapsed));
  }, [userId]);

  return {
    ...englishAdventureProgress(ids, seconds),
    markCompleted,
    markActivityCompleted,
    recordStudySeconds,
  };
}

export function useAdventureActivityTimer(activityId: string | null) {
  const { recordStudySeconds } = useEnglishAdventuresProgress();
  useEffect(() => {
    if (!activityId) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        recordStudySeconds(Math.floor((now - last) / 1000));
      }
      last = now;
    }, 15000);
    return () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") {
        recordStudySeconds(Math.floor((Date.now() - last) / 1000));
      }
    };
  }, [activityId, recordStudySeconds]);
}
