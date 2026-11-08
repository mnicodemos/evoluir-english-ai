import { useCallback, useEffect, useRef, useState } from "react";

import { useProfile } from "@/hooks/useProfile";
import {
  loadEnglishAdventureCheckpoints,
  saveEnglishAdventureCheckpoint,
} from "@/lib/englishAdventureCheckpoint.functions";
import { markActivityComplete, saveCompletedAdventure } from "@/lib/englishAdventuresProgress";
import {
  advanceCheckpoint,
  EMPTY_ADVENTURE_CHECKPOINT,
  reconcile,
  restartCheckpoint,
  type AdventureCheckpoint,
} from "@/lib/englishAdventureCheckpointSync";

export type EnglishAdventureId =
  | "a1-welcome-mix-up"
  | "a1-neighbourhood-mystery"
  | "a2-surprise-delivery"
  | "a2-community-festival";

export type EnglishAdventureCheckpoint = AdventureCheckpoint;

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

const EMPTY_CHECKPOINT: EnglishAdventureCheckpoint = EMPTY_ADVENTURE_CHECKPOINT;

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
    dirty: false,
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
      dirty: Boolean(value.dirty),
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

export function useEnglishAdventureCheckpoint(adventureId: EnglishAdventureId, totalSteps: number) {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const [checkpoint, setCheckpoint] = useState(EMPTY_CHECKPOINT);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const checkpointRef = useRef(EMPTY_CHECKPOINT);
  const restartRef = useRef(false);
  const savingRef = useRef(false);

  const publish = useCallback((next: EnglishAdventureCheckpoint) => {
    checkpointRef.current = next;
    setCheckpoint(next);
  }, []);

  const accept = useCallback(
    (next: EnglishAdventureCheckpoint) => {
      publish(next);
      if (userId) {
        writeLocalCheckpoint(userId, adventureId, next);
        next.completedActivityIds.forEach((id) => markActivityComplete(userId, id));
        if (next.completed) saveCompletedAdventure(userId, adventureId);
      }
    },
    [adventureId, publish, userId],
  );

  /** Sends the current dirty copy; on a revision conflict the server copy wins. */
  const flush = useCallback(async () => {
    if (!userId || savingRef.current) return;
    savingRef.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const snapshot = checkpointRef.current;
        if (!snapshot.dirty) break;
        const restart = restartRef.current;
        const result = await saveEnglishAdventureCheckpoint({
          data: {
            adventureId,
            currentStep: snapshot.currentStep,
            choices: snapshot.choices,
            decisions: snapshot.decisions,
            recovered: snapshot.recovered,
            completedActivityIds: snapshot.completedActivityIds,
            completed: snapshot.completed,
            expectedRevision: snapshot.revision,
            restart,
          },
        });
        const remote = result.checkpoint ? fromRow(result.checkpoint as CheckpointRow) : null;
        const latest = checkpointRef.current;
        if (result.saved && remote) {
          if (restart && latest === snapshot) restartRef.current = false;
          // Changes made while the request was in flight stay dirty on the new revision.
          accept(
            latest === snapshot
              ? remote
              : { ...latest, revision: remote.revision, dirty: true,
                  completedActivityIds: [...new Set([...remote.completedActivityIds, ...latest.completedActivityIds])] },
          );
        } else {
          restartRef.current = false;
          accept(reconcile({ ...latest, dirty: false }, remote).checkpoint);
        }
      }
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("english-adventure-progress-updated"));
      }
    }
  }, [accept, adventureId, userId]);

  const syncRemote = useCallback(async () => {
    if (!userId) return;
    const rows = (await loadEnglishAdventureCheckpoints()) as CheckpointRow[];
    const row = rows.find((item) => item.adventure_id === adventureId);
    const { checkpoint: next, push } = reconcile(
      checkpointRef.current,
      row ? fromRow(row) : null,
    );
    accept(next);
    if (push) await flush();
    setSaveError(false);
  }, [accept, adventureId, flush, userId]);

  useEffect(() => {
    let active = true;
    setReady(false);
    const local = userId ? readLocalCheckpoint(userId, adventureId) : EMPTY_CHECKPOINT;
    publish(local);
    restartRef.current = false;

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
      if (restart) restartRef.current = true;
      accept({ ...next, dirty: true });
      void flush();
    },
    [accept, flush],
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
      if (!ready) return;
      const current = checkpointRef.current;
      const next = advanceCheckpoint(current, adventureId, totalSteps, decision);
      if (next !== current) persist(next);
    },
    [adventureId, persist, ready, totalSteps],
  );

  const restart = useCallback(() => {
    persist(restartCheckpoint(checkpointRef.current), true);
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
