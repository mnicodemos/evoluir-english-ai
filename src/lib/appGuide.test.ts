import { describe, expect, it } from "vitest";

import { APP_GUIDE, GUIDE_GROUPS, GUIDE_MAX_STEPS, appGuideStrings } from "./appGuide";
import { uiPt } from "./uiDictionary";

describe("app guide", () => {
  it("has a Portuguese line for every English line", () => {
    expect(appGuideStrings().filter((line) => !uiPt[line])).toEqual([]);
    expect(GUIDE_GROUPS.filter((group) => !uiPt[group.title])).toEqual([]);
  });

  it("has one section per main part, each with steps and a unique id", () => {
    const ids = APP_GUIDE.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(APP_GUIDE.every((section) => section.steps.length >= 2)).toBe(true);
  });

  it("shows at most four steps at once and opens with how to study", () => {
    // A list of alternatives (the study-day rules) is read whole.
    expect(
      APP_GUIDE.filter((section) => !section.anyOf && section.steps.length > GUIDE_MAX_STEPS),
    ).toEqual([]);
    expect(APP_GUIDE[0]?.id).toBe("how-to-study");
  });
});
