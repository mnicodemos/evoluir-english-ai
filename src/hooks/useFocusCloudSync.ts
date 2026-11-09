import { useEffect, useRef, useState } from "react";

import { addFocusLog, clearFocusLog, useFocusLog } from "@/hooks/useFocusLog";
import { useProfile } from "@/hooks/useProfile";
import { loadFocusCloudSnapshot, saveFocusCloudSnapshot } from "@/lib/focusTimer.functions";
import { FOCUS_IDLE, focusRestoreState, type FocusState } from "@/lib/focusTimer";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import type { FocusActivity } from "@/lib/life";

/**
 * Keeps the timer and its independent session history available on every
 * signed-in device. Window position/open state intentionally remains local.
 */
export function useFocusCloudSync() {
  const { data: profile } = useProfile();
  const { state } = useFocusTimer();
  const sessions = useFocusLog();
  const userId = profile?.id;
  const revision = useRef(0);
  const readyForWrites = useRef(false);
  const loadingUser = useRef<string | null>(null);
  const latestState = useRef<FocusState>(state);
  const [syncEpoch, setSyncEpoch] = useState(0);

  latestState.current = state;

  useEffect(() => {
    if (!userId || loadingUser.current === userId) return;
    loadingUser.current = userId;
    readyForWrites.current = false;
    try {
      const owner = window.localStorage.getItem("evoluir-focus-owner");
      if (owner && owner !== userId) {
        focusRestoreState(FOCUS_IDLE);
        clearFocusLog();
      }
      window.localStorage.setItem("evoluir-focus-owner", userId);
    } catch {
      // Cloud sync still works if local storage is unavailable.
    }
    void loadFocusCloudSnapshot()
      .then((remote) => {
        revision.current = remote.revision;
        for (const row of remote.sessions) {
          addFocusLog({
            key: String(row.key),
            day: String(row.day),
            minutes: Number(row.minutes),
            partial: Boolean(row.partial),
            startedAt: row.startedAt == null ? undefined : Number(row.startedAt),
            endedAt: Number(row.endedAt),
            preset: row.preset as "short" | "classic" | "deep",
            taskId: (row.taskId as string | null) ?? null,
            activity: (row.activity as FocusActivity | null) ?? null,
          });
        }

        const local = latestState.current;
        const remoteState = remote.state as FocusState | null;
        // An active local session is kept; otherwise restore the cloud copy.
        // The next CAS save reconciles any local session that was newer.
        if (remoteState && local.phase === "idle" && remoteState.phase !== "idle") {
          focusRestoreState(remoteState);
        } else if (remoteState && local.phase === "idle" && remoteState.phase === "idle") {
          focusRestoreState(remoteState);
        }
      })
      .catch(() => {
        // Keep the local timer usable while offline; a later mount/reload retries.
      })
      .finally(() => {
        readyForWrites.current = true;
        setSyncEpoch((value) => value + 1);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId || !readyForWrites.current) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const payload = {
        preset: state.preset,
        phase: state.phase,
        endsAt: state.endsAt,
        left: state.left,
        blocks: state.blocks,
        taskId: state.taskId,
        key: state.key,
        lastTaskId: state.lastTaskId,
        startedAt: state.startedAt,
        activity: state.activity,
      };
      const logPayload = sessions.map((entry) => ({
        key: entry.key,
        day: entry.day,
        minutes: entry.minutes,
        partial: Boolean(entry.partial),
        startedAt: entry.startedAt ?? null,
        endedAt: entry.endedAt ?? Date.now(),
        preset: entry.preset ?? "classic",
        taskId: entry.taskId ?? null,
        activity: entry.activity ?? null,
      }));
      try {
        for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
          const result = await saveFocusCloudSnapshot({
            data: { state: payload, sessions: logPayload, expectedRevision: revision.current },
          });
          revision.current = result.revision;
          if (result.saved) break;
          // A second device wrote first: retry against its new revision, with
          // this device's most recent user action, rather than losing it.
        }
      } catch {
        // Offline writes remain local and will be retried after the next change.
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userId, state, sessions, syncEpoch]);
}
