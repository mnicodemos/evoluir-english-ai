import { describe, expect, it } from "vitest";

import { challengeFor, challengeOption, challengeStorageKey } from "./realLifeChallenges";

describe("Real-Life Challenge prototype", () => {
  it("exists only for b1-u2-l4", () => {
    expect(challengeFor("b1-u2-l4")).not.toBeNull();
    expect(challengeFor("b1-u2-l2")).toBeNull();
    expect(challengeFor("b1-u1-l6")).toBeNull();
    expect(challengeFor(null)).toBeNull();
  });

  it("has three options, each with consequence and feedback", () => {
    const challenge = challengeFor("b1-u2-l4")!;
    expect(challenge.options).toHaveLength(3);
    for (const option of challenge.options) {
      expect(option.consequence.length).toBeGreaterThan(20);
      expect(option.feedback.length).toBeGreaterThan(20);
    }
  });

  it("only the four-part email with a modal works well", () => {
    const challenge = challengeFor("b1-u2-l4")!;
    expect(challengeOption(challenge, "professional")?.outcome).toBe("works");
    expect(challengeOption(challenge, "informal")?.outcome).toBe("adjust");
    expect(challengeOption(challenge, "direct")?.outcome).toBe("adjust");
    const best = challengeOption(challenge, "professional")!.text;
    expect(best).toContain("Dear Mr. Davies");
    expect(best).toContain("I am writing to");
    expect(best).toContain("Could");
    expect(best).toContain("Please let me know");
  });

  it("try again clears the choice; completion is kept per student and lesson", () => {
    const challenge = challengeFor("b1-u2-l4")!;
    expect(challengeOption(challenge, null)).toBeNull();
    expect(challengeStorageKey("u1", "b1-u2-l4")).toBe("real-life-challenge:u1:b1-u2-l4");
  });
});
