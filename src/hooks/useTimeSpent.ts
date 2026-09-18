import { useCallback, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { logPracticeTelemetry } from "@/lib/legacyActivity.functions";

const IDLE_MS = 60_000;

export type TimeSpent = {
  /**
   * Minutes spent on the activity since the previous call (never double-counted),
   * rounded, never below `min`.
   */
  (min?: number): number;
  /** Starts counting — used when the student actually begins an activity. */
  start: () => void;
  /** Stops counting — used when the activity ends. */
  stop: () => void;
  /** Seconds measured but not reported yet (useful for debugging/display). */
  pendingSeconds: () => number;
};

/**
 * Measures how long the student is actually *doing* an activity, not how long
 * the screen is open. Time while the tab is hidden never counts.
 *
 * - `manual: true` — the clock only runs between `start()` and `stop()`.
 * - default — the clock runs while the student interacts, and pauses after a
 *   minute without any interaction.
 */
export function useTimeSpent(options?: { manual?: boolean }): TimeSpent {
  const manual = options?.manual ?? false;
  const activeMs = useRef(0);
  const startedAt = useRef<number | null>(manual ? null : Date.now());
  const reportedMs = useRef(0);

  const flush = useCallback(() => {
    if (startedAt.current !== null) {
      activeMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (startedAt.current === null && document.visibilityState !== "hidden") {
      startedAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  // Automatic mode: pause the clock when the student stops interacting.
  useEffect(() => {
    if (manual) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    function onActivity() {
      resume();
      if (idle) clearTimeout(idle);
      idle = setTimeout(flush, IDLE_MS);
    }
    const events = ["pointerdown", "keydown", "input", "scroll"] as const;
    for (const e of events) document.addEventListener(e, onActivity, { passive: true });
    onActivity();
    return () => {
      for (const e of events) document.removeEventListener(e, onActivity);
      if (idle) clearTimeout(idle);
    };
  }, [manual, flush, resume]);

  return useMemo(() => {
    const read = ((min = 1) => {
      const total =
        activeMs.current + (startedAt.current !== null ? Date.now() - startedAt.current : 0);
      // Never below zero: a previous call may have rounded a few seconds up.
      const delta = Math.max(0, total - reportedMs.current);
      // Rounded to the nearest minute (30s+ counts as a minute) and the seconds
      // already reported are stored, so nothing is counted twice or thrown away.
      const minutes = Math.max(min, Math.round(delta / 60000));
      reportedMs.current += minutes * 60000;
      return minutes;
    }) as TimeSpent;
    read.start = resume;
    read.stop = flush;
    read.pendingSeconds = () => {
      const total =
        activeMs.current + (startedAt.current !== null ? Date.now() - startedAt.current : 0);
      return Math.max(0, Math.round((total - reportedMs.current) / 1000));
    };
    return read;
  }, [resume, flush]);
}

/**
 * Stores the practice time that was not logged yet when the student leaves the
 * screen, so every minute spent on an activity is recorded — even when the
 * activity is abandoned halfway through.
 */
export function useLogTimeOnExit(params: {
  timer: TimeSpent;
  profile:
    { id: string; streak_days: number; last_activity_date: string | null } | null | undefined;
  type: string;
  title: string;
}) {
  const { timer } = params;
  const logTelemetry = useServerFn(logPracticeTelemetry);
  const operationKey = useRef(crypto.randomUUID());
  const latest = useRef(params);
  latest.current = params;

  useEffect(() => {
    const currentOperationKey = operationKey.current;
    return () => {
      timer.stop();
      const { profile, type } = latest.current;
      const minutes = timer(0);
      if (minutes >= 1 && profile) {
        void logTelemetry({
          data: {
            operationKey: currentOperationKey,
            activityType: type as
              | "listening_practice"
              | "vocabulary_reading"
              | "conversation_practice"
              | "writing_practice"
              | "lesson_practice"
              | "final_test_practice",
            minutes,
          },
        });
      }
    };
  }, [timer, logTelemetry]);
}
