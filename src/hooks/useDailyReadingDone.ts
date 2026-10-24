import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { studyDayStartIso } from "@/lib/today";

/** Whether today's daily reading was finished (a "daily_reading" activity
 *  since the São Paulo day start). Shared by the bell and Keep improving;
 *  finishing the reading refreshes every query, this one included. */
export function useDailyReadingDone(userId?: string) {
  return useQuery({
    queryKey: ["daily-reading-done", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("activity_type", "daily_reading")
        .gte("created_at", studyDayStartIso());
      return (count ?? 0) > 0;
    },
  });
}
