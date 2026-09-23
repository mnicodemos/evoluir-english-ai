import { describe, expect, it } from "vitest";

import {
  dashboardActionAvailable,
  listeningHasNewActivity,
  vocabularyHasNewActivity,
  writingHasNewActivity,
} from "@/lib/activityIndicators";

describe("Dashboard recommended actions", () => {
  const available = { listening: true, writing: false, vocabulary: false };

  it("uses the completion state Listening and Writing already own", () => {
    expect(dashboardActionAvailable("/listening", available)).toBe(true);
    expect(dashboardActionAvailable("/writing", available)).toBe(false);
  });

  it("keeps Vocabulary available: opening the batch is not doing the practice", () => {
    expect(dashboardActionAvailable("/vocabulary", available)).toBe(true);
  });

  it("does not block lessons or open-ended practice surfaces", () => {
    expect(dashboardActionAvailable("/learning/$lessonId", available)).toBe(true);
    expect(dashboardActionAvailable("/coach", available)).toBe(true);
    expect(dashboardActionAvailable("/teacher", available)).toBe(true);
  });
});


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
  it("shows the dot when the student never reviewed a word", () => {
    expect(vocabularyHasNewActivity({ day: "2026-09-22", lastReviewedAt: null })).toBe(true);
  });

  it("keeps the dot when the last real review was on a previous day", () => {
    expect(
      vocabularyHasNewActivity({
        day: "2026-09-23",
        lastReviewedAt: "2026-09-22T18:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("disappears only after a real review on this day", () => {
    expect(
      vocabularyHasNewActivity({
        day: "2026-09-22",
        lastReviewedAt: "2026-09-22T09:12:00.000Z",
      }),
    ).toBe(false);
  });

  it("does not show a dot without a study day", () => {
    expect(vocabularyHasNewActivity({ day: "", lastReviewedAt: null })).toBe(false);
  });
});
