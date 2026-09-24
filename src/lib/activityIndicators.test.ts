import { describe, expect, it } from "vitest";

import {
  dashboardActionAvailable,
  listeningHasNewActivity,
  vocabularyHasNewActivity,
  vocabularyIndicatorVisible,
  writingHasNewActivity,
} from "@/lib/activityIndicators";

describe("Dashboard recommended actions", () => {
  const available = { listening: true, writing: false, vocabulary: false };

  it("uses the completion state Listening and Writing already own", () => {
    expect(dashboardActionAvailable("/listening", available)).toBe(true);
    expect(dashboardActionAvailable("/writing", available)).toBe(false);
  });

  it("hides Vocabulary when the current batch has nothing left to practise", () => {
    expect(dashboardActionAvailable("/vocabulary", available)).toBe(false);
    expect(dashboardActionAvailable("/vocabulary", { ...available, vocabulary: true })).toBe(true);
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
    expect(writingHasNewActivity({ prompts: ["a", "b", "c"], done: ["a"], tasksPerRound })).toBe(
      true,
    );
  });

  it("shows the dot when the round was never opened", () => {
    expect(writingHasNewActivity({ prompts: [], done: [], tasksPerRound })).toBe(true);
  });
});

describe("Vocabulary indicator", () => {
  const ids = ["w1", "w2", "w3"];

  it("shows the dot when a saved word is ready to practise", () => {
    expect(
      vocabularyHasNewActivity({ batchWordIds: ["w1"], masteryByWordId: {}, batchSize: 3 }),
    ).toBe(true);
  });

  it("keeps the dot while a word of the batch is still not mastered", () => {
    expect(
      vocabularyHasNewActivity({
        batchWordIds: ids,
        masteryByWordId: { w1: 100, w2: 100 },
        batchSize: 3,
      }),
    ).toBe(true);
  });

  it("disappears once every word of the round is mastered", () => {
    expect(
      vocabularyHasNewActivity({
        batchWordIds: ids,
        masteryByWordId: { w1: 100, w2: 80, w3: 75 },
        batchSize: 3,
      }),
    ).toBe(false);
  });

  it("stays hidden when the saved batch is empty", () => {
    expect(vocabularyHasNewActivity({ batchWordIds: [], masteryByWordId: {}, batchSize: 3 })).toBe(
      false,
    );
  });

  it("stays hidden while saved words are loading", () => {
    expect(
      vocabularyIndicatorVisible({
        batch: { batchWordIds: ["w1"], masteryByWordId: {} },
        isLoading: true,
        isError: false,
      }),
    ).toBe(false);
  });

  it("stays hidden after a saved-word read or generation error", () => {
    const batch = { batchWordIds: ["w1"], masteryByWordId: {} };
    expect(vocabularyIndicatorVisible({ batch, isLoading: false, isError: true })).toBe(false);
    expect(
      vocabularyIndicatorVisible({
        batch,
        isLoading: false,
        isError: false,
        generationFailed: true,
      }),
    ).toBe(false);
  });
});
