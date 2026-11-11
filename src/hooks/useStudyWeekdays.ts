import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { normalizeStudyDays } from "@/lib/studyPlan";

/** Shared, normalized source for every view of the student's selected weekdays. */
export function useStudyWeekdays(userId: string, daysPerWeek = 3) {
  return useQuery({
    queryKey: ["study-weekdays", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("study_days, study_days_per_week")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return normalizeStudyDays(
        data?.study_days as string[] | null,
        data?.study_days_per_week ?? daysPerWeek,
      );
    },
  });
}
