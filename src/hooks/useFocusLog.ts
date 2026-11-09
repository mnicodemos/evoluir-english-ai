import { useEffect, useState } from "react";

import { addDays, type FocusSessionLog } from "@/lib/life";
import { readStorage, writeStorage } from "@/lib/safeStorage";
import { studyToday } from "@/lib/today";

// The focus blocks of the last 30 days, kept on this device only (user
// decision, 2026-10-17: simpler than the database), finished or stopped early
// (partial: minutes only). Each block carries the key of its run, so it is
// never counted twice.
const LOG_KEY = "evoluir-focus-log";
const LOG_EVENT = "evoluir-focus-log";
export type FocusLogEntry = FocusSessionLog & { key: string };

function readFocusLog(): FocusLogEntry[] {
  try {
    const raw = readStorage(LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as FocusLogEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearFocusLog() {
  writeStorage(LOG_KEY, JSON.stringify([]));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOG_EVENT));
}

export function addFocusLog(entry: FocusLogEntry) {
  const log = readFocusLog();
  if (log.some((item) => item.key === entry.key)) return;
  const since = addDays(studyToday(), -29);
  writeStorage(LOG_KEY, JSON.stringify([...log.filter((item) => item.day >= since), entry]));
  window.dispatchEvent(new Event(LOG_EVENT));
}

/** This device's focus blocks, kept in step with the timer and other tabs. */
export function useFocusLog(): FocusLogEntry[] {
  const [log, setLog] = useState<FocusLogEntry[]>([]);
  useEffect(() => {
    const sync = () => setLog(readFocusLog());
    sync();
    window.addEventListener(LOG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LOG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return log;
}
