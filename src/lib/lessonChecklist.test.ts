import { describe, expect, it } from "vitest";

import { flashcardsDone, lessonChecklist } from "@/lib/lessonChecklist";

const base = {
  hasVideo: true,
  videoWatched: false,
  cardsTotal: 10,
  cardsReviewed: 0,
  quizPassed: false,
};

describe("lesson checklist", () => {
  it("lists the three steps of a lesson", () => {
    expect(lessonChecklist(base).items.map((item) => item.id)).toEqual([
      "video",
      "flashcards",
      "quiz",
    ]);
  });

  it("points out when only the video confirmation is missing", () => {
    const state = lessonChecklist({
      ...base,
      cardsReviewed: 10,
      quizPassed: true,
    });
    expect(state.onlyVideoPending).toBe(true);
    expect(state.allDone).toBe(false);
    expect(state.pending).toEqual(["video"]);
  });

  it("is complete when everything is done", () => {
    const state = lessonChecklist({
      ...base,
      videoWatched: true,
      cardsReviewed: 10,
      quizPassed: true,
    });
    expect(state.allDone).toBe(true);
    expect(state.onlyVideoPending).toBe(false);
  });

  it("does not ask for a video the lesson does not have", () => {
    const state = lessonChecklist({ ...base, hasVideo: false });
    expect(state.pending).not.toContain("video");
  });

  it("accepts most of the deck as reviewed", () => {
    expect(flashcardsDone(10, 6)).toBe(true);
    expect(flashcardsDone(10, 5)).toBe(false);
    expect(flashcardsDone(0, 0)).toBe(true);
  });

  it("still reports the quiz as pending when the score is low", () => {
    const state = lessonChecklist({ ...base, videoWatched: true, cardsReviewed: 10 });
    expect(state.pending).toEqual(["quiz"]);
    expect(state.onlyVideoPending).toBe(false);
  });
});
