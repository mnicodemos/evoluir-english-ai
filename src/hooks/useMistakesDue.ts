import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MISTAKE_MASTERED_STEP } from "@/lib/mistakeReview";

/**
 * My mistakes waiting for review today: the same queue the My mistakes page
 * shows (step 0, review date arrived). One query (["mistakes-due", id]) shared
 * by the bell, Keep improving and the phone EVO card; My mistakes invalidates
 * it after each answer.
 */
export function useMistakesDue(userId?: string) {
  return useQuery({
    queryKey: ["mistakes-due", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("learning_errors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("review_step", 0)
        .lt("review_step", MISTAKE_MASTERED_STEP)
        .lte("next_review_at", new Date().toISOString());
      return count ?? 0;
    },
  });
}
