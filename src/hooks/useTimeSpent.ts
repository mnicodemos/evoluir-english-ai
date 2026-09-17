import { useCallback, useEffect, useMemo, useRef } from "react";

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
      const total = activeMs.current + (startedAt.current !== null ? Date.now() - startedAt.current : 0);
      const delta = total - reportedMs.current;
      // Only whole minutes are reported; the leftover seconds stay for the next call,
      // so several short actions never add up to more time than was really spent.
      const minutes = Math.max(min, Math.floor(delta / 60000));
      reportedMs.current += minutes * 60000;
      return minutes;
    }) as TimeSpent;
    read.start = resume;
    read.stop = flush;
    return read;
  }, [resume, flush]);
}
