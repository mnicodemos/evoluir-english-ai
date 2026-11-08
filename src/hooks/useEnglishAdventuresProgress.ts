import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import { logPracticeTelemetry } from "@/lib/legacyActivity.functions";
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

  const markCompleted = useCallback(
    (adventureId: string) => {
      if (!userId) return;
      saveCompletedAdventure(userId, adventureId);
      setIds(readCompletedActivities(userId));

      // Credit the final partial minute when the student completes the story.
      const pendingKey = `evoluir-english-adventures:${userId}:pending-telemetry-seconds`;
      let pending = 0;
      try {
        pending = Math.max(0, Number(window.localStorage.getItem(pendingKey) ?? 0));
        if (pending > 0) window.localStorage.setItem(pendingKey, "0");
      } catch {
        // Completion and local progress must still succeed without storage.
      }
      if (pending > 0) {
        void logPracticeTelemetry({
          data: {
            operationKey: crypto.randomUUID(),
            activityType: "english_adventures",
            minutes: 1,
          },
        }).catch(() => {
          try {
            window.localStorage.setItem(pendingKey, String(pending));
          } catch {
            // Keep the completion state even if telemetry cannot be retried.
          }
        });
      }
    },
    [userId],
  );

  const markActivityCompleted = useCallback(
    (activityId: string) => {
      if (!userId) return;
      setIds(markActivityComplete(userId, activityId));
    },
    [userId],
  );

  const recordStudySeconds = useCallback(
    (elapsed: number) => {
      if (!userId || elapsed <= 0) return;
      setSeconds(addStudySeconds(userId, elapsed));

      // Persist each complete minute through the existing authenticated,
      // idempotent activity pipeline. Keep sub-minute time locally until the
      // next timer tick so scene changes do not discard it.
      const pendingKey = `evoluir-english-adventures:${userId}:pending-telemetry-seconds`;
      let pending = 0;
      try {
        pending = Math.max(0, Number(window.localStorage.getItem(pendingKey) ?? 0));
      } catch {
        // The local progress counter remains available if storage is blocked.
      }
      pending += Math.floor(elapsed);
      const wholeMinutes = Math.floor(pending / 60);
      pending %= 60;
      try {
        window.localStorage.setItem(pendingKey, String(pending));
      } catch {
        // Do not interrupt the adventure when local storage is unavailable.
      }

      for (let index = 0; index < wholeMinutes; index += 1) {
        void logPracticeTelemetry({
          data: {
            operationKey: crypto.randomUUID(),
            activityType: "english_adventures",
            minutes: 1,
          },
        }).catch(() => {
          // Restore the minute for a later retry rather than losing study time.
          try {
            const current = Number(window.localStorage.getItem(pendingKey) ?? 0);
            window.localStorage.setItem(pendingKey, String(current + 60));
          } catch {
            // The dashboard still retains the local adventure timer total.
          }
        });
      }
    },
    [userId],
  );

  return {
    ...englishAdventureProgress(ids, seconds),
    completedActivityIds: ids,
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
