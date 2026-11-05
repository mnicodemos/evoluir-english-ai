import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { loadLife } from "@/lib/life.functions";

/** Life+ AI data (goals' deadline and milestones, routine, habits, priority) in one cached read. */
export function useLife() {
  // Resolve the cached auth session locally, in parallel with useProfile().
  // Waiting for the profile query here serialized two independent Home loads.
  const { data: sessionUserId } = useQuery({
    queryKey: ["life-session-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session?.user.id ?? null;
    },
    staleTime: Infinity,
  });
  const load = useServerFn(loadLife);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["life", sessionUserId ?? null],
    enabled: !!sessionUserId,
    queryFn: () => load(),
    staleTime: 30 * 1000,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["life"] });
    // Goal steps and the Dashboard card read the goals too.
    void queryClient.invalidateQueries({ queryKey: ["plus"] });
  };
  return { ...query, refresh };
}
