import { describe, expect, it } from "vitest";

import { APP_GUIDE, appGuideStrings } from "./appGuide";
import { uiPt } from "./uiDictionary";

describe("app guide", () => {
  it("has a Portuguese line for every English line", () => {
    expect(appGuideStrings().filter((line) => !uiPt[line])).toEqual([]);
  });

  it("has one section per main part, each with steps and a unique id", () => {
    const ids = APP_GUIDE.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(APP_GUIDE.every((section) => section.steps.length >= 2)).toBe(true);
  });
});
