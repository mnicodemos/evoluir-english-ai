import { describe, expect, it } from "vitest";

import { FOCUS_IDLE, type FocusState } from "@/lib/focusTimer";
import { resetFocusFromPreviousStudyDay } from "@/lib/focusStudyDay";

const previousDay = new Date("2026-11-17T15:00:00-03:00").getTime();
const today = new Date("2026-11-18T09:00:00-03:00").getTime();

function activeState(overrides: Partial<FocusState> = {}): FocusState {
  return {
    ...FOCUS_IDLE,
    preset: "deep",
    phase: "focus",
    endsAt: null,
    left: 24 * 60_000 + 18_000,
    startedAt: previousDay,
    key: "previous-session",
    ...overrides,
  };
}

describe("resetFocusFromPreviousStudyDay", () => {
  it("clears a paused focus session from a previous study day", () => {
    expect(resetFocusFromPreviousStudyDay(activeState(), today)).toEqual({
      ...FOCUS_IDLE,
      preset: "deep",
    });
  });

  it("keeps a session started today", () => {
    const state = activeState({ startedAt: today });
    expect(resetFocusFromPreviousStudyDay(state, today)).toEqual(state);
  });

  it("keeps an idle timer and its selected preset", () => {
    const state = { ...FOCUS_IDLE, preset: "short" as const };
    expect(resetFocusFromPreviousStudyDay(state, today)).toEqual(state);
  });
});
