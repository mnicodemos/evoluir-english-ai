import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/hooks/useProfile";
import { loadEnglishAdventureCheckpoints } from "@/lib/englishAdventureCheckpoint.functions";
import { consolidateHomeIds } from "@/lib/englishAdventureCheckpointSync";
import { logPracticeTelemetry } from "@/lib/legacyActivity.functions";
import {
  type AdventureLevel,
  addStudySeconds,
  englishAdventureProgress,
  markActivityComplete,
  readCompletedActivities,
  readStudySeconds,
  saveCompletedAdventure,
} from "@/lib/englishAdventuresProgress";

export function useEnglishAdventuresProgress(level?: AdventureLevel) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const userId = profile?.id;
  const persistAdventureMinute = useCallback(async () => {
    if (!userId) return;
    await logPracticeTelemetry({
      data: {
        operationKey: crypto.randomUUID(),
        activityType: "english_adventures",
        minutes: 1,
      },
    });
    // Refresh the same server-backed query used by the Home daily goal as soon
    // as the minute is persisted; do not wait for polling or Realtime delivery.
    await queryClient.invalidateQueries({ queryKey: ["minutes-today", userId] });
  }, [queryClient, userId]);
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
      saveCompletedAdventure(userId, adventureId);
      setIds(readCompletedActivities(userId));
      window.dispatchEvent(new Event("english-adventure-progress-updated"));

      const pendingKey = `evoluir-english-adventures:${userId}:pending-telemetry-seconds`;
      let pending = 0;
      try {
        pending = Math.max(0, Number(window.localStorage.getItem(pendingKey) ?? 0));
        if (pending > 0) window.localStorage.setItem(pendingKey, "0");
      } catch {
        // Completion and local progress must still succeed without storage.
      }
      if (pending > 0) {
        void persistAdventureMinute().catch(() => {
          try {
            window.localStorage.setItem(pendingKey, String(pending));
          } catch {
            // Keep the completion state even if telemetry cannot be retried.
          }
        });
      }
    },
    [persistAdventureMinute, userId],
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
      setSeconds(addStudySeconds(userId, elapsed));

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
          try {
            const current = Number(window.localStorage.getItem(pendingKey) ?? 0);
            window.localStorage.setItem(pendingKey, String(current + 60));
          } catch {
            // The dashboard still retains the local adventure timer total.
          }
        });
      }
    },
    [persistAdventureMinute, userId],
  );

  return {
    ...englishAdventureProgress(ids, seconds, level),
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
