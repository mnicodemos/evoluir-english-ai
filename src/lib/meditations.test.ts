import { describe, expect, it } from "vitest";

import { MEDITATION_LABELS, MEDITATIONS, meditationMinutes, meditationTier } from "./meditations";
import { uiPt } from "./uiDictionary";

describe("meditations in English", () => {
  it("gives A1 to B1 the simpler script and B2 to C2 the richer one", () => {
    expect(meditationTier("a2")).toBe("simple");
    expect(meditationTier("B1")).toBe("simple");
    expect(meditationTier("c1")).toBe("rich");
    expect(meditationTier(null)).toBe("simple");
  });

  it("has both scripts, with Portuguese for every line, and one free session", () => {
    for (const session of MEDITATIONS) {
      for (const tier of ["simple", "rich"] as const) {
        expect(session.lines[tier].length).toBeGreaterThanOrEqual(6);
        expect(session.lines[tier].every((line) => line.en && line.pt && line.pause > 0)).toBe(
          true,
        );
      }
      expect(session.words).toHaveLength(5);
    }
    expect(MEDITATIONS.filter((session) => session.free)).toHaveLength(1);
  });

  it("lasts a few minutes and has every screen label translated", () => {
    const minutes = meditationMinutes(MEDITATIONS[0]!.lines.simple, 0.85);
    expect(minutes).toBeGreaterThanOrEqual(1);
    expect(minutes).toBeLessThanOrEqual(5);
    expect(MEDITATION_LABELS.filter((label) => !uiPt[label])).toEqual([]);
  });
});
