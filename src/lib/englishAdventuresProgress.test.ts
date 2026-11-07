import { describe, expect, it } from "vitest";

import {
  completedAdventureIds,
  ENGLISH_ADVENTURES_TOTAL,
  englishAdventureProgress,
} from "./englishAdventuresProgress";

describe("English Adventures progress", () => {
  it("uses 40 activities as the total", () => {
    expect(ENGLISH_ADVENTURES_TOTAL).toBe(40);
    expect(englishAdventureProgress(["a1-1", "a1-2", "a2-1", "a2-2"])).toEqual({
      completed: 4,
      total: 40,
      percent: 10,
      minutes: 0,
    });
  });

  it("counts a completed adventure only once", () => {
    const ids = completedAdventureIds(["a1-1"], "a1-1");
    expect(ids).toEqual(["a1-1"]);
    expect(englishAdventureProgress(ids).percent).toBe(3);
  });
});
