import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * How many lessons the student has already started (any progress row in user_lessons).
 * Listening Lab, Writing and Vocabulary use this number as their "round": every time the
 * student starts a new lesson, a fresh set of activities is generated.
 */
export function useLessonRound() {
  return useQuery({
    queryKey: ["lesson-round"],
    refetchOnMount: "always",
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("user_lessons")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}
