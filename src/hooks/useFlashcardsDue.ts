import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { isFlashcardDue, lessonStarted } from "@/lib/flashcards";
import { studyToday } from "@/lib/today";

/**
 * Lesson flashcards whose spaced review date has arrived (owner request,
 * 2026-10-30: the reviews were scheduled but nothing told the student, so they
 * never came back). Under the ["user-flashcards"] key, which the review page
 * refreshes after each rating, so the bell and Keep improving follow it.
 */
export function useFlashcardsDue(userId?: string) {
  return useQuery({
    queryKey: ["user-flashcards", "due", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // The same rule as the review deck (isFlashcardDue): cards never rated
      // from opened lessons count too.
      const [cards, states, lessons] = await Promise.all([
        supabase.from("flashcards").select("id, lesson_id"),
        supabase
          .from("user_flashcards")
          .select("flashcard_id, next_review_date")
          .eq("user_id", userId!),
        supabase
          .from("user_lessons")
          .select("lesson_id, video_progress, progress, completed_at")
          .eq("user_id", userId!),
      ]);
      if (cards.error) throw cards.error;
      if (states.error) throw states.error;
      if (lessons.error) throw lessons.error;
      const byCard = new Map(
        (states.data ?? []).map((state) => [state.flashcard_id, state] as const),
      );
      const started = new Set(
        (lessons.data ?? []).filter(lessonStarted).map((lesson) => lesson.lesson_id),
      );
      const today = studyToday();
      return (cards.data ?? []).filter((card) =>
        isFlashcardDue(card, byCard.get(card.id), started, today),
      ).length;
    },
  });
}
