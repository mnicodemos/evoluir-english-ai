import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { DashboardHeaderStat } from "@/components/DashboardHeaderStat";
import { supabase } from "@/integrations/supabase/client";
import { leagueLevelOf } from "@/lib/level";

/**
 * Dashboard header cell: the student's place in this week's league (same
 * weekly_league ranking and query key as the league page), or an invitation to
 * join. Uses the trophy icon; the league artwork stays on the league page.
 */
export function WeeklyLeagueSummary({
  profile,
  translate,
}: {
  profile: { id: string; level: string | null; max_level?: string | null };
  translate: (label: string) => string;
}) {
  const { data: rows } = useQuery({
    queryKey: ["weekly-league", profile.id, leagueLevelOf(profile)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const me = rows?.find((row) => row.is_me);
  const joined = !!me?.joined;
  const total = rows?.filter((row) => row.joined).length ?? 0;

  return (
    <DashboardHeaderStat
      icon={<Trophy className="size-6" strokeWidth={2.2} />}
      tone="amber"
      label={translate("Weekly league")}
      value={
        joined
          ? total > 1
            ? `#${me?.rank_position ?? "–"} ${translate("of")} ${total}`
            : `${me?.xp ?? 0} XP`
          : translate("Join the league")
      }
      detail={
        joined
          ? total > 1
            ? `${me?.xp ?? 0} XP ${translate("this week")}`
            : translate("Leading this week")
          : translate("Compete with students at your level")
      }
      to="/league"
    />
  );
}
