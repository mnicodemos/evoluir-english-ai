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
  const activityKey = `${window.location.pathname}${window.location.search}`;
  window.dispatchEvent(
    new CustomEvent(STUDY_STARTED_EVENT, { detail: { activity, activityKey } }),
  );
}

export function canStartOfferedFocus(state: Pick<FocusState, "phase">) {
  return state.phase === "idle";
}

/**
 * One invitation per student, activity and São Paulo day. Reopening the same
 * activity does not nag the student, but moving to another activity can offer
 * Focus again. The in-memory map preserves the gate when browser storage fails.
 */
export function createFocusOfferGate(read = readStorage, write = writeStorage) {
  const offered = new Set<string>();
  return (
    userId: string | undefined,
    state: Pick<FocusState, "phase">,
    day = studyToday(),
    activityKey = "general",
  ) => {
    if (!userId || !canStartOfferedFocus(state)) return false;
    const key = `evoluir-focus-offered:${userId}:${day}:${encodeURIComponent(activityKey)}`;
    if (offered.has(key) || read(key) === "1") return false;
    offered.add(key);
    write(key, "1");
    return true;
  };
}
