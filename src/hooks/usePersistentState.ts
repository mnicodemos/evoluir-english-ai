import { useEffect, useRef, useState } from "react";

/**
 * State that survives leaving the page: it is mirrored in localStorage under
 * `key` so a user who exits in the middle of a lesson comes back to exactly
 * where they were. Pass `key = null` to disable persistence.
 */
export function usePersistentState<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore unreadable drafts */
    }
  }, [key]);

  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    if (loadedFor.current !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked */
    }
  }, [key, value]);

  function clear() {
    if (key && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }

  return [value, setValue, clear] as const;
}
