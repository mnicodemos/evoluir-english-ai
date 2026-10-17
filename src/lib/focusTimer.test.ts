import { afterEach, describe, expect, it, vi } from "vitest";

import {
  focusCompleteDue,
  focusPause,
  focusResume,
  focusStart,
  focusStop,
  focusView,
  getFocusSnapshot,
  shouldTuckFocusWidget,
} from "./focusTimer";

describe("focus timer store", () => {
  afterEach(() => {
    focusStop();
    vi.useRealTimers();
  });

  it("ends a focus block once, then its break", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
    focusStart();
    const started = getFocusSnapshot().state;
    expect(started.phase).toBe("focus");
    expect(focusCompleteDue(Date.now() + 60_000)).toBeNull();

    const end = started.endsAt!;
    const ended = focusCompleteDue(end);
    expect(ended).toMatchObject({ kind: "focus", minutes: 25, key: started.key });
    expect(focusCompleteDue(end)).toBeNull();
    const breakState = getFocusSnapshot().state;
    expect(breakState.phase).toBe("break");
    expect(breakState.endsAt).toBe(end + 5 * 60_000);

    expect(focusCompleteDue(breakState.endsAt!)).toEqual({ kind: "break" });
    expect(getFocusSnapshot().state.phase).toBe("idle");
    expect(getFocusSnapshot().state.blocks).toBe(1);
  });

  it("pauses and resumes with the time that was left", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
    focusStart();
    vi.setSystemTime(new Date("2026-10-17T12:10:00Z"));
    focusPause();
    const paused = getFocusSnapshot().state;
    expect(paused.endsAt).toBeNull();
    expect(focusView(paused, Date.now()).leftMs).toBe(15 * 60_000);
    vi.setSystemTime(new Date("2026-10-17T13:00:00Z"));
    focusResume();
    expect(getFocusSnapshot().state.endsAt).toBe(Date.now() + 15 * 60_000);
  });
});

describe("floating window on Ready", () => {
  const open = { open: true, minimized: false, x: null, y: null };

  it("tucks an idle open window into its pill", () => {
    expect(shouldTuckFocusWidget(getFocusSnapshot().state, open)).toBe(true);
  });

  it("leaves a running timer, a pill and a closed window alone", () => {
    focusStart();
    expect(shouldTuckFocusWidget(getFocusSnapshot().state, open)).toBe(false);
    focusStop();
    expect(shouldTuckFocusWidget(getFocusSnapshot().state, { ...open, minimized: true })).toBe(
      false,
    );
    expect(shouldTuckFocusWidget(getFocusSnapshot().state, { ...open, open: false })).toBe(false);
  });
});
