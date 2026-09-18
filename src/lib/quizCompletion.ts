export const LESSON_QUIZ_PASS_SCORE = 70;

export type QuizCompletionDependencies = {
  persistLegacy: () => Promise<void>;
  completeLesson: () => Promise<void>;
};

export async function finalizeLessonQuiz(
  score: number,
  dependencies: QuizCompletionDependencies,
) {
  await dependencies.persistLegacy();
  const passed = score >= LESSON_QUIZ_PASS_SCORE;
  if (passed) await dependencies.completeLesson();
  return { passed, legacyPersisted: true };
}