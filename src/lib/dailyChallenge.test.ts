import { describe, expect, it } from "vitest";

import { dailyChallengeGoal, practiceXpLabel, pronunciationQuickWinDone } from "./dailyChallenge";

describe("daily challenge goal", () => {
  it("counts today's texts toward a Writing challenge and is reached at three", () => {
    const rows = [{ activity_type: "writing", duration_minutes: 4 }];
    expect(dailyChallengeGoal("/writing", rows)).toEqual({
      target: 3,
      done: 1,
      unit: "texts",
      reached: false,
    });
    expect(dailyChallengeGoal("/writing", [...rows, ...rows, ...rows])?.reached).toBe(true);
  });

  it("measures the AI Teacher in minutes and a conversation by the call or AI Speaking", () => {
    expect(
      dailyChallengeGoal("/teacher", [{ activity_type: "teacher", duration_minutes: 12 }]),
    ).toMatchObject({ done: 10, reached: true });
    expect(
      dailyChallengeGoal("/coach", [{ activity_type: "video_call", duration_minutes: 5 }])?.reached,
    ).toBe(true);
  });

  it("has no goal for Vocabulary (it leaves when no word is due)", () => {
    expect(dailyChallengeGoal("/vocabulary", [])).toBeNull();
  });

  it("labels the league XP each practice earns", () => {
    expect(practiceXpLabel("/writing")).toBe("+20 XP");
    expect(practiceXpLabel("/reading")).toBe("+20 XP");
    expect(practiceXpLabel("/learning/$lessonId")).toBe("+50 XP");
    expect(practiceXpLabel("/teacher")).toBeNull();
  });
});

describe("pronunciation Quick Win", () => {
  it("is done once five words were pronounced today", () => {
    const say = { activity_type: "vocabulary", duration_minutes: 0 };
    expect(pronunciationQuickWinDone([say, say, say, say])).toBe(false);
    expect(pronunciationQuickWinDone([say, say, say, say, say, say])).toBe(true);
    expect(
      pronunciationQuickWinDone([
        say,
        say,
        say,
        say,
        { activity_type: "writing", duration_minutes: 5 },
      ]),
    ).toBe(false);
  });
});
