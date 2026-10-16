import { useEffect, useState } from "react";

import { haptic } from "@/lib/haptics";
import { studyToday } from "@/lib/today";

/**
 * True for a moment the first time today the student sees `reached` (user
 * request: celebrate the day's goal). Remembered per goal and day in this
 * browser, so it never repeats on every visit.
 */
export function useCelebrate(id: string, reached: boolean) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!reached) return;
    const key = `evoluir-celebrated:${id}:${studyToday()}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    haptic("success");
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 1600);
    return () => window.clearTimeout(timer);
  }, [id, reached]);
  return active;
}
