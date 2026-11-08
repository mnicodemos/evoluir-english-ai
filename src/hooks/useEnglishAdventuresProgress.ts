import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import { loadEnglishAdventureCheckpoints } from "@/lib/englishAdventureCheckpoint.functions";
import { consolidateHomeIds } from "@/lib/englishAdventureCheckpointSync";
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

    let active = true;
    const sync = async () => {
      const localIds = readCompletedActivities(userId);
      setIds(localIds);
      setSeconds(readStudySeconds(userId));
      try {
        const rows = (await loadEnglishAdventureCheckpoints()) as Array<{
          completed_activity_ids: string[] | null;
        }>;
        if (!active) return;
        // Read-only consolidation: the Home never writes the narrative checkpoint.
        const mergedIds = consolidateHomeIds(localIds, rows);
        setIds(mergedIds);
      } catch {
        if (active) setIds(readCompletedActivities(userId));
      }
    };

    void sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("english-adventure-progress-updated", sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("english-adventure-progress-updated", sync);
    };
  }, [userId]);

  const markCompleted = useCallback(
    (adventureId: string) => {
      if (!userId) return;
      // Completing a story must not round its leftover seconds up to a minute.
      // Only recordStudySeconds may emit complete-minute telemetry.
      saveCompletedAdventure(userId, adventureId);
      setIds(readCompletedActivities(userId));
      window.dispatchEvent(new Event("english-adventure-progress-updated"));
    },
    [userId],
  );

  const markActivityCompleted = useCallback(
    (activityId: string) => {
      if (!userId) return;
      setIds(markActivityComplete(userId, activityId));
      window.dispatchEvent(new Event("english-adventure-progress-updated"));
    },
    [userId],
  );

  const recordStudySeconds = useCallback(
    (elapsed: number) => {
      if (!userId || elapsed <= 0) return;
      const wholeSeconds = Math.floor(elapsed);
      if (wholeSeconds <= 0) return;
      setSeconds(addStudySeconds(userId, wholeSeconds));

      const pendingKey = `evoluir-english-adventures:${userId}:pending-telemetry-seconds`;
      let pending = 0;
      try {
        pending = Math.max(0, Number(window.localStorage.getItem(pendingKey) ?? 0));
      } catch {
        // The local progress counter remains available if storage is blocked.
      }
      pending += wholeSeconds;
      const wholeMinutes = Math.floor(pending / 60);
      pending %= 60;
      try {
        window.localStorage.setItem(pendingKey, String(pending));
      } catch {
        // Do not interrupt the adventure when local storage is unavailable.
      }

      for (let index = 0; index < wholeMinutes; index += 1) {
        const operationKey = crypto.randomUUID();
        void logPracticeTelemetry({
          data: {
            operationKey,
            activityType: "english_adventures",
            minutes: 1,
          },
        }).catch(() => {
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

    const MAX_TRUSTED_INTERVAL_MS = 20_000;
    let last = Date.now();
    let fractionalSeconds = 0;

    const flushElapsed = () => {
      const now = Date.now();
      const elapsedMs = now - last;
      last = now;

      // Ignore long gaps caused by device sleep, browser suspension or throttling.
      if (
        document.visibilityState !== "visible" ||
        elapsedMs <= 0 ||
        elapsedMs > MAX_TRUSTED_INTERVAL_MS
      ) {
        return;
      }

      const accumulated = fractionalSeconds + elapsedMs / 1000;
      const wholeSeconds = Math.floor(accumulated);
      fractionalSeconds = accumulated - wholeSeconds;
      if (wholeSeconds > 0) recordStudySeconds(wholeSeconds);
    };

    const handleVisibilityChange = () => {
      // Never count time spent with the adventure tab hidden.
      last = Date.now();
      fractionalSeconds = 0;
    };

    const timer = window.setInterval(flushElapsed, 5000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      flushElapsed();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activityId, recordStudySeconds]);
}
