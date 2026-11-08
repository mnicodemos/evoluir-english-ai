import { useCallback, useEffect, useRef, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import {
  loadEnglishAdventureCheckpoints,
  saveEnglishAdventureCheckpoint,
} from "@/lib/englishAdventureCheckpoint.functions";

export type EnglishAdventureId =
  | "a1-welcome-mix-up"
  | "a1-neighbourhood-mystery"
  | "a2-surprise-delivery"
  | "a2-community-festival";

export type EnglishAdventureCheckpoint = {
  currentStep: number;
  choices: Record<string, number>;
  decisions: string[];
  recovered: number;
  completedActivityIds: string[];
  completed: boolean;
  revision: number;
};

type CheckpointRow = {
  adventure_id: EnglishAdventureId;
  current_step: number;
  choices: Record<string, number> | null;
  decisions: string[] | null;
  recovered: number | null;
  completed_activity_ids: string[] | null;
  completed: boolean;
  revision: number;
};

const EMPTY_CHECKPOINT: EnglishAdventureCheckpoint = {
  currentStep: 0,
  choices: {},
  decisions: [],
  recovered: 0,
  completedActivityIds: [],
  completed: false,
  revision: 0,
};

function fromRow(row: CheckpointRow): EnglishAdventureCheckpoint {
  return {
    currentStep: row.current_step,
    choices: row.choices ?? {},
    decisions: row.decisions ?? [],
    recovered: row.recovered ?? 0,
    completedActivityIds: row.completed_activity_ids ?? [],
    completed: row.completed,
    revision: row.revision,
  };
}

export function useEnglishAdventureCheckpoint(
  adventureId: EnglishAdventureId,
  totalSteps: number,
) {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const [checkpoint, setCheckpoint] = useState(EMPTY_CHECKPOINT);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const revisionRef = useRef(0);
  const pendingRef = useRef<EnglishAdventureCheckpoint | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    setCheckpoint(EMPTY_CHECKPOINT);
    revisionRef.current = 0;
    pendingRef.current = null;

    if (!userId) {
      setReady(true);
      return () => {
        active = false;
      };
    }

    void loadEnglishAdventureCheckpoints()
      .then((rows: CheckpointRow[]) => {
        if (!active) return;
        const row = rows.find((item) => item.adventure_id === adventureId);
        const next = row ? fromRow(row) : EMPTY_CHECKPOINT;
        revisionRef.current = next.revision;
        setCheckpoint(next);
        setSaveError(false);
      })
      .catch(() => {
        if (active) setSaveError(true);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [adventureId, userId]);

  const persist = useCallback(
    (next: EnglishAdventureCheckpoint) => {
      setCheckpoint(next);
      pendingRef.current = next;
      if (!userId || savingRef.current) return;

      savingRef.current = true;
      void (async () => {
        while (pendingRef.current) {
          const snapshot = pendingRef.current;
          pendingRef.current = null;
          try {
            const result = await saveEnglishAdventureCheckpoint({
              data: {
                adventureId,
                currentStep: snapshot.currentStep,
                choices: snapshot.choices,
                decisions: snapshot.decisions,
                recovered: snapshot.recovered,
                completedActivityIds: snapshot.completedActivityIds,
                completed: snapshot.completed,
                expectedRevision: revisionRef.current,
              },
            });

            if (!result.saved) {
              const latest = fromRow(result.checkpoint as CheckpointRow);
              revisionRef.current = latest.revision;
              pendingRef.current = null;
              setCheckpoint(latest);
              setSaveError(false);
              break;
            }

            revisionRef.current = result.checkpoint.revision;
            setCheckpoint((current) => ({ ...current, revision: result.checkpoint.revision }));
            setSaveError(false);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("english-adventure-progress-updated"));
            }
          } catch {
            pendingRef.current = snapshot;
            setSaveError(true);
            break;
          }
        }
        savingRef.current = false;
      })();
    },
    [adventureId, userId],
  );

  const choose = useCallback(
    (choiceIndex: number, recoveredDelta = 0) => {
      if (!ready || checkpoint.completed || checkpoint.currentStep >= totalSteps) return;
      persist({
        ...checkpoint,
        choices: { ...checkpoint.choices, [String(checkpoint.currentStep)]: choiceIndex },
        recovered: checkpoint.recovered + Math.max(0, recoveredDelta),
      });
    },
    [checkpoint, persist, ready, totalSteps],
  );

  const continueStep = useCallback(
    (decision?: string) => {
      if (!ready || checkpoint.completed || checkpoint.currentStep >= totalSteps) return;
      const activityId = `${adventureId}:${checkpoint.currentStep}`;
      const nextStep = Math.min(checkpoint.currentStep + 1, totalSteps);
      persist({
        ...checkpoint,
        currentStep: nextStep,
        decisions: decision ? [...checkpoint.decisions, decision] : checkpoint.decisions,
        completedActivityIds: [...new Set([...checkpoint.completedActivityIds, activityId])],
        completed: nextStep >= totalSteps,
      });
    },
    [adventureId, checkpoint, persist, ready, totalSteps],
  );

  const restart = useCallback(() => {
    persist({
      ...EMPTY_CHECKPOINT,
      completedActivityIds: checkpoint.completedActivityIds,
      revision: checkpoint.revision,
    });
  }, [checkpoint.completedActivityIds, checkpoint.revision, persist]);

  return {
    ...checkpoint,
    ready,
    saveError,
    selectedChoice:
      checkpoint.currentStep < totalSteps
        ? (checkpoint.choices[String(checkpoint.currentStep)] ?? null)
        : null,
    choose,
    continueStep,
    restart,
  };
}
