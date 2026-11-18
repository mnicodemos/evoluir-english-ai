import { FOCUS_IDLE, type FocusState } from "@/lib/focusTimer";
import { studyToday } from "@/lib/today";

/**
 * Focus blocks never carry into a new São Paulo study day. Preserve the
 * student's selected preset, but clear an unfinished session from yesterday.
 */
export function resetFocusFromPreviousStudyDay(
  state: FocusState,
  now: number = Date.now(),
): FocusState {
  if (state.phase === "idle" || state.startedAt === null) return state;
  if (studyToday(new Date(state.startedAt)) === studyToday(new Date(now))) return state;
  return { ...FOCUS_IDLE, preset: state.preset };
}
