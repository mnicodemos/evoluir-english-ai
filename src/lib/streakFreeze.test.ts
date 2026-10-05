import { describe, expect, it } from "vitest";

import { freezeAvailable, streakAlive, weekStartOf } from "./streakFreeze";

describe("streak protection", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
  });

  it("allows one protected day per week", () => {
    expect(freezeAvailable(null, "2026-10-08")).toBe(true);
    expect(freezeAvailable("2026-10-06", "2026-10-08")).toBe(false);
    expect(freezeAvailable("2026-10-04", "2026-10-08")).toBe(true);
  });

  it("keeps the streak alive for today, yesterday or a protected yesterday", () => {
    expect(streakAlive("2026-10-08", null, "2026-10-08").alive).toBe(true);
    expect(streakAlive("2026-10-07", null, "2026-10-08").alive).toBe(true);
    expect(streakAlive("2026-10-06", null, "2026-10-08")).toEqual({
      alive: true,
      protectedDay: "2026-10-07",
    });
    expect(streakAlive("2026-10-06", "2026-10-05", "2026-10-08").alive).toBe(false);
    expect(streakAlive("2026-10-05", null, "2026-10-08").alive).toBe(false);
    expect(streakAlive(null, null, "2026-10-08").alive).toBe(false);
  });

  it("reports a protection the database already applied", () => {
    expect(streakAlive("2026-10-08", "2026-10-07", "2026-10-08").protectedDay).toBe("2026-10-07");
  });
});
