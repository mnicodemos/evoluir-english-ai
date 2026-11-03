import { describe, expect, it, vi } from "vitest";
import { canStartOfferedFocus, createFocusOfferGate, isStudyInteraction } from "./focusStudyOffer";

describe("Focus study invitation", () => {
  it("offers once per student and day, including when declined", () => {
    const store = new Map<string, string>();
    const claim = createFocusOfferGate(k => store.get(k) ?? null, (k, v) => { store.set(k, v); });
    expect(claim("student", { phase: "idle" }, "2026-11-02")).toBe(true);
    expect(claim("student", { phase: "idle" }, "2026-11-02")).toBe(false);
    expect(claim("other", { phase: "idle" }, "2026-11-02")).toBe(true);
    expect(claim("student", { phase: "idle" }, "2026-11-03")).toBe(true);
    const reloaded = createFocusOfferGate(k => store.get(k) ?? null, vi.fn());
    expect(reloaded("student", { phase: "idle" }, "2026-11-03")).toBe(false);
  });

  it.each(["focus", "break"] as const)("never replaces a running or paused %s phase", phase => {
    expect(canStartOfferedFocus({ phase })).toBe(false);
    expect(createFocusOfferGate(() => null, vi.fn())("student", { phase })).toBe(false);
  });

  it("requires a student and remembers the offer when storage is unavailable", () => {
    const claim = createFocusOfferGate(() => null, vi.fn());
    expect(claim(undefined, { phase: "idle" })).toBe(false);
    expect(claim("student", { phase: "idle" })).toBe(true);
    expect(claim("student", { phase: "idle" })).toBe(false);
  });

  it("requires study content, not navigation or header controls", () => {
    const target = (inMain: boolean, excluded: boolean) => ({
      closest: (selector: string) => selector === "main" ? (inMain ? {} : null) : (excluded ? {} : null),
    }) as unknown as Element;
    expect(isStudyInteraction(null)).toBe(false);
    expect(isStudyInteraction(target(false, false))).toBe(false);
    expect(isStudyInteraction(target(true, true))).toBe(false);
    expect(isStudyInteraction(target(true, false))).toBe(true);
  });
});