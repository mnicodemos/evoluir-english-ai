import { useUserLessons } from "@/hooks/useLearning";

/**
 * How many lessons the student has already completed. Listening Lab, Writing and
 * Vocabulary use this number as their "round". It is derived from the same
 * ["user-lessons"] dataset the rest of the app already loads — retaking a lesson
 * does not open a new round.
 */
export function useLessonRound() {
  const { data, isLoading, error } = useUserLessons();
  return {
    data: data ? data.filter((row) => row.completed_at).length : undefined,
    isLoading,
    error,
  };
}
