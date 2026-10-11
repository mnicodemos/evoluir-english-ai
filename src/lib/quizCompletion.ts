export const LESSON_QUIZ_PASS_SCORE = 70;

export type QuizCompletionDependencies = {
  persistLegacy: () => Promise<void>;
  completeLesson: () => Promise<void>;
};

/** A vocabulary batch is unlocked once, when a lesson first changes to completed. */
export function lessonCompletionUnlocksVocabulary(input: {
  passed: boolean;
  wasAlreadyCompleted: boolean;
}) {
  return input.passed && !input.wasAlreadyCompleted;
}

/**
 * Records the attempt (minutes, activity) and, when it passed, completes the
 * lesson. The two are independent: a failed activity record must never keep a
 * passed lesson open (user report: 75% and the lesson stayed open). A failed
 * completion still throws, so the screen can say so.
 */
export async function finalizeLessonQuiz(score: number, dependencies: QuizCompletionDependencies) {
  const legacyPersisted = await dependencies.persistLegacy().then(
    () => true,
    () => false,
  );
  const passed = score >= LESSON_QUIZ_PASS_SCORE;
  if (passed) await dependencies.completeLesson();
  return { passed, legacyPersisted };
}
