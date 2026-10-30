import { describe, expect, it } from "vitest";

import {
  EXTRA_VIDEO_QUICK_WIN,
  isExtraVideoDay,
  withExtraVideoQuickWin,
} from "./extraVideoQuickWin";

const step = { quickWin: null, other: 1 };
const on = { premium: true, levelHasVideos: true, watchedToday: false };

describe("extra video Quick Win", () => {
  it("comes one study day in three", () => {
    const days = [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ];
    expect(days.filter(isExtraVideoDay)).toHaveLength(2);
  });

  it("replaces the Quick Win only for Premium, with videos, not watched today", () => {
    const day = ["2026-11-01", "2026-11-02", "2026-11-03"].find(isExtraVideoDay)!;
    expect(withExtraVideoQuickWin(step, { day, ...on }).quickWin).toBe(EXTRA_VIDEO_QUICK_WIN);
    expect(withExtraVideoQuickWin(step, { day, ...on, premium: false }).quickWin).toBeNull();
    expect(withExtraVideoQuickWin(step, { day, ...on, levelHasVideos: false }).quickWin).toBeNull();
    expect(withExtraVideoQuickWin(step, { day, ...on, watchedToday: true }).quickWin).toBeNull();
    const otherDay = ["2026-11-01", "2026-11-02", "2026-11-03"].find((d) => !isExtraVideoDay(d))!;
    expect(withExtraVideoQuickWin(step, { day: otherDay, ...on }).quickWin).toBeNull();
  });
});
