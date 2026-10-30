import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
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
      const { count } = await supabase
        .from("user_flashcards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .lte("next_review_date", studyToday());
      return count ?? 0;
    },
  });
}
