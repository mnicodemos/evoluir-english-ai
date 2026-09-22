/**
 * What is still missing for a lesson to feel finished.
 *
 * Completion itself is unchanged: the server marks the lesson complete when the
 * quiz reaches 70%. This checklist only makes the remaining steps visible, so a
 * student who forgot to confirm the video is never left guessing.
 */

export type LessonChecklistInput = {
  hasVideo: boolean;
  videoWatched: boolean;
  cardsTotal: number;
  cardsReviewed: number;
  quizPassed: boolean;
};

export type LessonChecklistItem = {
  id: "video" | "flashcards" | "quiz";
  label: string;
  done: boolean;
};

/** Reviewing most of the deck is enough — students rarely rate every card. */
export function flashcardsDone(total: number, reviewed: number) {
  if (total === 0) return true;
  return reviewed >= Math.max(1, Math.ceil(total * 0.6));
}

export function lessonChecklist(input: LessonChecklistInput) {
  const items: LessonChecklistItem[] = [
    { id: "video", label: "Watch the video", done: !input.hasVideo || input.videoWatched },
    {
      id: "flashcards",
      label: "Review the flashcards",
      done: flashcardsDone(input.cardsTotal, input.cardsReviewed),
    },
    { id: "quiz", label: "Pass the quiz (70%)", done: input.quizPassed },
  ];

  const pending = items.filter((item) => !item.done).map((item) => item.id);

  return {
    items,
    pending,
    allDone: pending.length === 0,
    /** The student did the work but never confirmed the video. */
    onlyVideoPending: pending.length === 1 && pending[0] === "video",
  };
}
