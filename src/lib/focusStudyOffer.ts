import type { FocusActivity } from "./life";
import type { FocusState } from "./focusTimer";
import { readStorage, writeStorage } from "./safeStorage";
import { studyToday } from "./today";

export const STUDY_STARTED_EVENT = "evoluir-study-started";

/** Only interactions inside study content qualify, never menus or page headers. */
export function isStudyInteraction(target: Element | null): boolean {
  return !!target?.closest("main") && !target.closest("header, nav, a, [role='dialog']");
}

export function announceStudyInteraction(target: Element | null, activity?: FocusActivity) {
  if (!isStudyInteraction(target)) return;
  window.dispatchEvent(
    activity
      ? new CustomEvent(STUDY_STARTED_EVENT, { detail: { activity } })
      : new Event(STUDY_STARTED_EVENT),
  );
}

export function canStartOfferedFocus(state: Pick<FocusState, "phase">) {
  return state.phase === "idle";
}

/** One invitation per student / São Paulo day, with an in-memory storage fallback. */
export function createFocusOfferGate(read = readStorage, write = writeStorage) {
  const offered = new Map<string, string>();
  return (userId: string | undefined, state: Pick<FocusState, "phase">, day = studyToday()) => {
    if (!userId || !canStartOfferedFocus(state)) return false;
    const key = `evoluir-focus-offered:${userId}`;
    if (offered.get(key) === day || read(key) === day) return false;
    offered.set(key, day);
    write(key, day);
    return true;
  };
}
