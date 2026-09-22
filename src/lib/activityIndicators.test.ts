import { describe, expect, it } from "vitest";

import {
  listeningHasNewActivity,
  vocabularyHasNewActivity,
  vocabularySignature,
  writingHasNewActivity,
} from "@/lib/activityIndicators";

describe("Listening Lab indicator", () => {
  it("shows nothing when the current round was completed", () => {
    expect(listeningHasNewActivity({ round: 4, completedRound: 4 })).toBe(false);
  });

  it("shows the dot when a new round was unlocked", () => {
    expect(listeningHasNewActivity({ round: 5, completedRound: 4 })).toBe(true);
  });

  it("shows the dot when the student never practised", () => {
    expect(listeningHasNewActivity({ round: 0, completedRound: null })).toBe(true);
  });
});

describe("Writing indicator", () => {
  const tasksPerRound = 3;

  it("shows nothing when every task of the round was corrected", () => {
    expect(
      writingHasNewActivity({ prompts: ["a", "b", "c"], done: ["a", "b", "c"], tasksPerRound }),
    ).toBe(false);
  });

  it("shows the dot when a task is still open", () => {
    expect(
      writingHasNewActivity({ prompts: ["a", "b", "c"], done: ["a"], tasksPerRound }),
    ).toBe(true);
  });

  it("shows the dot when the round was never opened", () => {
    expect(writingHasNewActivity({ prompts: [], done: [], tasksPerRound })).toBe(true);
  });
});

describe("Vocabulary indicator", () => {
  it("shows the dot for a batch the student has not opened", () => {
    expect(
      vocabularyHasNewActivity({
        signature: vocabularySignature("2026-09-22", 8),
        seenSignature: vocabularySignature("2026-09-22", 7),
      }),
    ).toBe(true);
  });

  it("disappears once the batch was opened", () => {
    const signature = vocabularySignature("2026-09-22", 8);
    expect(vocabularyHasNewActivity({ signature, seenSignature: signature })).toBe(false);
  });

  it("shows the dot on a new day", () => {
    expect(
      vocabularyHasNewActivity({
        signature: vocabularySignature("2026-09-23", 8),
        seenSignature: vocabularySignature("2026-09-22", 8),
      }),
    ).toBe(true);
  });

  it("does not show a dot without a signature", () => {
    expect(vocabularyHasNewActivity({ signature: "", seenSignature: null })).toBe(false);
  });
});
