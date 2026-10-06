import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SkillResultRow } from "@/lib/skillHistory";

/**
 * Assessed skill results of the last 7 days. Kept out of EvolutionChart so
 * pages can read it without loading the chart library.
 */
export function useSkillHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["skill-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("assessment_skill_results")
        .select("skill, score, assessed_at")
        .eq("user_id", userId!)
        .gte("assessed_at", since)
        .order("assessed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SkillResultRow[];
    },
  });
}
