import { describe, expect, it } from "vitest";

import { getStableAdventureChoiceOrder } from "./adventureChoiceOrder";

describe("getStableAdventureChoiceOrder", () => {
  it("returns each original choice index exactly once", () => {
    for (const step of [0, 1, 2, 3, 9]) {
      const order = getStableAdventureChoiceOrder("a1-welcome-mix-up", step, 3);
      expect([...order].sort()).toEqual([0, 1, 2]);
    }
  });

  it("changes the first position across consecutive activities", () => {
    const firstPositions = Array.from(
      { length: 10 },
      (_, step) => getStableAdventureChoiceOrder("a1-welcome-mix-up", step, 3)[0],
    );
    expect(new Set(firstPositions)).toEqual(new Set([0, 1, 2]));
    expect(firstPositions.slice(0, 3)).toEqual([
      firstPositions[0],
      firstPositions[1],
      firstPositions[2],
    ]);
  });

  it("is stable for the same adventure and step", () => {
    expect(getStableAdventureChoiceOrder("a2-community-festival", 4, 3)).toEqual(
      getStableAdventureChoiceOrder("a2-community-festival", 4, 3),
    );
  });

  it("handles zero or one choice without changing its indexes", () => {
    expect(getStableAdventureChoiceOrder("test", 0, 0)).toEqual([]);
    expect(getStableAdventureChoiceOrder("test", 0, 1)).toEqual([0]);
  });
});
