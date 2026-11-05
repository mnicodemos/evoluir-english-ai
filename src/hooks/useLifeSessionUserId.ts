import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const LIFE_SESSION_QUERY_KEY = ["life-session-user"] as const;

/**
 * Read the already-cached Supabase session without waiting for the profile
 * request. Server functions authenticate independently on the server.
 */
export function useLifeSessionUserId() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(LIFE_SESSION_QUERY_KEY, session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: LIFE_SESSION_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session?.user.id ?? null;
    },
    staleTime: Infinity,
  });

  return data ?? null;
}
