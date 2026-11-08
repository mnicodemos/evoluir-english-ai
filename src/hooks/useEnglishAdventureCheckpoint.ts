import { useCallback, useEffect, useRef, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import {
  loadEnglishAdventureCheckpoints,
  saveEnglishAdventureCheckpoint,
} from "@/lib/englishAdventureCheckpoint.functions";
import { markActivityComplete, saveCompletedAdventure } from "@/lib/englishAdventuresProgress";

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

const localKey = (userId: string, adventureId: EnglishAdventureId) =>
  `evoluir-english-adventure-checkpoint:${userId}:${adventureId}`;

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

function readLocalCheckpoint(userId: string, adventureId: EnglishAdventureId) {
  try {
    const raw = window.localStorage.getItem(localKey(userId, adventureId));
    if (!raw) return EMPTY_CHECKPOINT;
    const value = JSON.parse(raw) as Partial<EnglishAdventureCheckpoint>;
    return {
      ...EMPTY_CHECKPOINT,
      ...value,
      choices: value.choices ?? {},
      decisions: value.decisions ?? [],
      completedActivityIds: value.completedActivityIds ?? [],
      revision: Number.isInteger(value.revision) ? value.revision! : 0,
    };
  } catch {
    return EMPTY_CHECKPOINT;
  }
}

function writeLocalCheckpoint(
  userId: string,
  adventureId: EnglishAdventureId,
  checkpoint: EnglishAdventureCheckpoint,
) {
  try {
    window.localStorage.setItem(localKey(userId, adventureId), JSON.stringify(checkpoint));
  } catch {
    // Cloud persistence remains available when browser storage is blocked.
  }
}

function mergeCheckpoints(
  local: EnglishAdventureCheckpoint,
  remote: EnglishAdventureCheckpoint,
): EnglishAdventureCheckpoint {
  return {
    currentStep: Math.max(local.currentStep, remote.currentStep),
    choices:
      local.currentStep >= remote.currentStep
        ? { ...remote.choices, ...local.choices }
        : { ...local.choices, ...remote.choices },
    decisions:
      local.decisions.length >= remote.decisions.length ? local.decisions : remote.decisions,
    recovered: Math.max(local.recovered, remote.recovered),
    completedActivityIds: [
      ...new Set([...remote.completedActivityIds, ...local.completedActivityIds]),
    ],
    completed: local.completed || remote.completed,
    revision: remote.revision,
  };
}

function hasProgress(checkpoint: EnglishAdventureCheckpoint) {
  return (
    checkpoint.currentStep > 0 ||
    Object.keys(checkpoint.choices).length > 0 ||
    checkpoint.completedActivityIds.length > 0 ||
    checkpoint.completed
  );
}

export function useEnglishAdventureCheckpoint(adventureId: EnglishAdventureId, totalSteps: number) {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const [checkpoint, setCheckpoint] = useState(EMPTY_CHECKPOINT);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const checkpointRef = useRef(EMPTY_CHECKPOINT);
  const revisionRef = useRef(0);
  const pendingRef = useRef<EnglishAdventureCheckpoint | null>(null);
  const savingRef = useRef(false);

  const publish = useCallback((next: EnglishAdventureCheckpoint) => {
    checkpointRef.current = next;
    setCheckpoint(next);
  }, []);

  const syncRemote = useCallback(async () => {
    if (!userId) return;
    const rows = (await loadEnglishAdventureCheckpoints()) as CheckpointRow[];
    const row = rows.find((item) => item.adventure_id === adventureId);
    const remote = row ? fromRow(row) : EMPTY_CHECKPOINT;
    const local = readLocalCheckpoint(userId, adventureId);
    const merged = mergeCheckpoints(local, remote);
    revisionRef.current = remote.revision;
    publish(merged);
    writeLocalCheckpoint(userId, adventureId, merged);
    merged.completedActivityIds.forEach((id) => markActivityComplete(userId, id));

    const needsCloudWrite =
      hasProgress(merged) &&
      (!row ||
        merged.currentStep > remote.currentStep ||
        merged.completedActivityIds.length > remote.completedActivityIds.length ||
        merged.completed !== remote.completed ||
        Object.keys(merged.choices).length > Object.keys(remote.choices).length ||
        merged.decisions.length > remote.decisions.length ||
        merged.recovered > remote.recovered ||
        JSON.stringify(merged.choices) !== JSON.stringify(remote.choices) ||
        JSON.stringify(merged.decisions) !== JSON.stringify(remote.decisions));
    if (needsCloudWrite) {
      const result = await saveEnglishAdventureCheckpoint({
        data: {
          adventureId,
          currentStep: merged.currentStep,
          choices: merged.choices,
          decisions: merged.decisions,
          recovered: merged.recovered,
          completedActivityIds: merged.completedActivityIds,
          completed: merged.completed,
          expectedRevision: remote.revision,
        },
      });
      const saved = fromRow(result.checkpoint as CheckpointRow);
      revisionRef.current = saved.revision;
      const finalCheckpoint = mergeCheckpoints(merged, saved);
      publish(finalCheckpoint);
      writeLocalCheckpoint(userId, adventureId, finalCheckpoint);
    }
    setSaveError(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("english-adventure-progress-updated"));
    }
  }, [adventureId, publish, userId]);

  useEffect(() => {
    let active = true;
    setReady(false);
    const local = userId ? readLocalCheckpoint(userId, adventureId) : EMPTY_CHECKPOINT;
    publish(local);
    revisionRef.current = local.revision;
    pendingRef.current = null;

    if (!userId) {
      setReady(true);
      return () => {
        active = false;
      };
    }

    void syncRemote()
      .catch(() => {
        if (active) setSaveError(true);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void syncRemote().catch(() => setSaveError(true));
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [adventureId, publish, syncRemote, userId]);

  const persist = useCallback(
    (next: EnglishAdventureCheckpoint, restart = false) => {
      publish(next);
      if (userId) {
        writeLocalCheckpoint(userId, adventureId, next);
        next.completedActivityIds.forEach((id) => markActivityComplete(userId, id));
        if (next.completed) saveCompletedAdventure(userId, adventureId);
      }
      pendingRef.current = next;
      if (!userId || savingRef.current) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("english-adventure-progress-updated"));
        }
        return;
      }

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
                restart,
              },
            });
            const saved = fromRow(result.checkpoint as CheckpointRow);
            revisionRef.current = saved.revision;
            const merged = mergeCheckpoints(snapshot, saved);
            publish(merged);
            if (userId) writeLocalCheckpoint(userId, adventureId, merged);
            setSaveError(false);
          } catch {
            pendingRef.current = snapshot;
            setSaveError(true);
            break;
          }
        }
        savingRef.current = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("english-adventure-progress-updated"));
        }
      })();
    },
    [adventureId, publish, userId],
  );

  const choose = useCallback(
    (choiceIndex: number, recoveredDelta = 0) => {
      const current = checkpointRef.current;
      if (!ready || current.completed || current.currentStep >= totalSteps) return;
      persist({
        ...current,
        choices: { ...current.choices, [String(current.currentStep)]: choiceIndex },
        recovered: current.recovered + Math.max(0, recoveredDelta),
      });
    },
    [persist, ready, totalSteps],
  );

  const continueStep = useCallback(
    (decision?: string) => {
      const current = checkpointRef.current;
      if (!ready || current.completed || current.currentStep >= totalSteps) return;
      const activityId = `${adventureId}:${current.currentStep}`;
      const nextStep = Math.min(current.currentStep + 1, totalSteps);
      persist({
        ...current,
        currentStep: nextStep,
        decisions: decision ? [...current.decisions, decision] : current.decisions,
        completedActivityIds: [...new Set([...current.completedActivityIds, activityId])],
        completed: nextStep >= totalSteps,
      });
    },
    [adventureId, persist, ready, totalSteps],
  );

  const restart = useCallback(() => {
    const current = checkpointRef.current;
    persist(
      {
        ...EMPTY_CHECKPOINT,
        completedActivityIds: current.completedActivityIds,
        revision: current.revision,
      },
      true,
    );
  }, [persist]);

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
