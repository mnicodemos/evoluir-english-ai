import { describe, expect, it } from "vitest";

import { alignLetters, closestHeard, missedParts } from "./pronunciationDiff";

const misses = (target: string, spoken: string) =>
  missedParts(alignLetters(target, closestHeard(target, spoken)));

describe("pronunciation by sound", () => {
  it("finds the heard word inside a longer transcript", () => {
    expect(closestHeard("thought", "I said tought okay")).toBe("tought");
    expect(closestHeard("notebook", "my note book")).toBe("note book");
  });

  it("marks every letter when the word was heard as written", () => {
    expect(alignLetters("Thought", "thought").every((m) => m.ok)).toBe(true);
    expect(misses("thought", "thought")).toEqual([]);
  });

  it("points at the part that came out different", () => {
    expect(misses("thought", "tought")).toEqual(["h"]);
    expect(misses("comfortable", "comfortabel")).toEqual(["le"]);
    expect(misses("vegetable", "vegible")).toEqual(["eta"]);
  });

  it("keeps spaces and hyphens neutral", () => {
    const result = alignLetters("check-in", "checkin");
    expect(result.find((m) => m.char === "-")?.ok).toBe(true);
    expect(missedParts(result)).toEqual([]);
  });

  it("marks everything when nothing usable was heard", () => {
    expect(misses("apple", "")).toEqual(["apple"]);
  });
});
