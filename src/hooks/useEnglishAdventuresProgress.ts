import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import { loadEnglishAdventureCheckpoints, saveEnglishAdventureCheckpoint } from "@/lib/englishAdventureCheckpoint.functions";
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
      setSeconds(readStudySeconds(userId));
      try {
        const rows = (await loadEnglishAdventureCheckpoints()) as Array<{
          adventure_id: string;
          current_step: number;
          choices: Record<string, number>;
          decisions: string[];
          recovered: number;
          completed_activity_ids: string[];
          completed: boolean;
          revision: number;
        }>;
        if (!active) return;

        const remoteIds = rows.flatMap((row) => row.completed_activity_ids ?? []);
        setIds([...new Set([...remoteIds, ...localIds])]);

        const adventureIds = [
          "a1-welcome-mix-up",
          "a1-neighbourhood-mystery",
          "a2-surprise-delivery",
          "a2-community-festival",
        ] as const;

        for (const adventureId of adventureIds) {
          const legacyIds = localIds.filter((id) => id.startsWith(`${adventureId}:`));
          if (!legacyIds.length) continue;
          const row = rows.find((item) => item.adventure_id === adventureId);
          const rowIds = row?.completed_activity_ids ?? [];
          if (row && legacyIds.every((id) => rowIds.includes(id))) continue;

          let legacyStep = 0;
          while (legacyIds.includes(`${adventureId}:${legacyStep}`)) legacyStep += 1;
          const totalSteps = 10;
          const result = await saveEnglishAdventureCheckpoint({
            data: {
              adventureId,
              currentStep: Math.max(row?.current_step ?? 0, legacyStep),
              choices: row?.choices ?? {},
              decisions: row?.decisions ?? [],
              recovered: row?.recovered ?? 0,
              completedActivityIds: [...new Set([...rowIds, ...legacyIds])],
              completed: Boolean(row?.completed) || legacyStep >= totalSteps,
              expectedRevision: row?.revision ?? 0,
            },
          });
          if (!active) return;
          const savedIds = result.checkpoint.completed_activity_ids ?? [];
          setIds((current) => [...new Set([...current, ...savedIds])]);
        }
      } catch {
        if (active) setIds(localIds);
      }
    };

    void sync();
    window.addEventListener("storage", sync);
    window.addEventListener("english-adventure-progress-updated", sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
      window.removeEventListener("english-adventure-progress-updated", sync);
    };
  }, [userId]);

  const markCompleted = useCallback(
    (adventureId: string) => {
      if (!userId) return;
      saveCompletedAdventure(userId, adventureId);
      setIds(readCompletedActivities(userId));
      window.dispatchEvent(new Event("english-adventure-progress-updated"));

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
      window.dispatchEvent(new Event("english-adventure-progress-updated"));
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
