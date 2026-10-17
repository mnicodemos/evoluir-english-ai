import { describe, expect, it } from "vitest";

import { coachReplyMessages } from "@/lib/ai-prompts";

import { fallbackOpenersFor, rolePlays, rolePlaysForGoal, scenarios } from "./coachScenarios";

describe("AI Speaking real situations", () => {
  it("puts the situations for the study plan goal first", () => {
    expect(rolePlaysForGoal("interview")[0]?.id).toBe("job-interview");
    expect(rolePlaysForGoal("travel")[0]?.id).toBe("hotel-check-in");
    expect(rolePlaysForGoal("travel")).toHaveLength(rolePlays.length);
    expect(rolePlaysForGoal(null)[0]?.id).toBe(rolePlays[0]?.id);
  });

  it("tells the AI to stay in its role", () => {
    const play = rolePlays.find((item) => item.id === "hotel-check-in")!;
    const [system] = coachReplyMessages(play.scenario, "b1", "travel", undefined, [], play.role);
    expect(system?.content).toContain("Role-play — You are a hotel receptionist");
    const [free] = coachReplyMessages("everyday", "b1", "travel", undefined, []);
    expect(free?.content).not.toContain("Role-play");
  });
});

describe("fallback openers by level", () => {
  it("gives A1-A2 short personal questions in every scenario", () => {
    for (const id of ["everyday", "professional", "travel"] as const) {
      for (const level of ["a1", "a2"]) {
        const lines = fallbackOpenersFor(id, level);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
          expect(line).not.toMatch(/imagine|interview/i);
        }
      }
    }
  });

  it("keeps the scenario openers from B1 up", () => {
    expect(fallbackOpenersFor("professional", "b1")).toEqual(
      scenarios.find((s) => s.id === "professional")!.fallbackOpeners,
    );
  });
});
