import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { diamondLevel } from "@/lib/diamondCycles";

/**
 * The student's Diamond level (1 = the Diamond, 2+ = cycles stored in
 * diamond_cycles, migration 0099). Reads nothing until the Diamond is earned,
 * and answers 1 while the table is missing (migration not applied yet).
 */
export function useDiamondLevel(userId: string | undefined, hasDiamond: boolean) {
  const { data = 1 } = useQuery({
    queryKey: ["diamond-cycles", userId],
    enabled: !!userId && hasDiamond,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      // Not in the generated Supabase types until Lovable regenerates them.
      const from = supabase.from.bind(supabase) as unknown as (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{ data: { cycle: number }[] | null; error: Error | null }>;
        };
      };
      const { data, error } = await from("diamond_cycles").select("cycle").eq("user_id", userId!);
      if (error) return 1;
      return diamondLevel((data ?? []).map((row) => row.cycle));
    },
  });
  return hasDiamond ? data : 0;
}
