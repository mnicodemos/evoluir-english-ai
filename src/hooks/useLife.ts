import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/useProfile";
import { loadLife } from "@/lib/life.functions";

/** Life AI data (goals' deadline and milestones, routine, habits, priority) in one cached read. */
export function useLife() {
  const { data: profile } = useProfile();
  const load = useServerFn(loadLife);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["life", profile?.id ?? null],
    enabled: !!profile,
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
