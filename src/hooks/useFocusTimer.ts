import { useEffect, useState, useSyncExternalStore } from "react";

import {
  focusView,
  getFocusSnapshot,
  getServerFocusSnapshot,
  subscribeFocus,
} from "@/lib/focusTimer";

/** The shared Focus timer (src/lib/focusTimer.ts) with a clock that ticks while it runs. */
export function useFocusTimer() {
  const { state, widget } = useSyncExternalStore(
    subscribeFocus,
    getFocusSnapshot,
    getServerFocusSnapshot,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (state.endsAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [state.endsAt]);
  return { state, widget, now, view: focusView(state, now) };
}
