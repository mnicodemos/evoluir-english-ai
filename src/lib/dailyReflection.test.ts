import { describe, expect, it } from "vitest";

import { getDailyReflection, getGreeting } from "./dailyReflection";

describe("daily reflection", () => {
  it("keeps the same reflection for the same user and study day", () => {
    const morning = new Date("2026-09-24T10:00:00-03:00");
    const evening = new Date("2026-09-24T21:00:00-03:00");
    expect(getDailyReflection("student-1", morning)).toEqual(
      getDailyReflection("student-1", evening),
    );
  });

  it("uses the date in the daily selection", () => {
    const today = getDailyReflection("student-1", new Date("2026-09-24T12:00:00-03:00"));
    const tomorrow = getDailyReflection("student-1", new Date("2026-09-25T12:00:00-03:00"));
    expect(tomorrow).not.toEqual(today);
  });

  it("selects the greeting from the current hour", () => {
    expect(getGreeting(8)).toBe("Good morning");
    expect(getGreeting(14)).toBe("Good afternoon");
    expect(getGreeting(21)).toBe("Good evening");
  });
});