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

export async function finalizeLessonQuiz(score: number, dependencies: QuizCompletionDependencies) {
  await dependencies.persistLegacy();
  const passed = score >= LESSON_QUIZ_PASS_SCORE;
  if (passed) await dependencies.completeLesson();
  return { passed, legacyPersisted: true };
}
