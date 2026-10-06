import { useQuery } from "@tanstack/react-query";
import { Medal } from "lucide-react";

import { DashboardHeaderStat } from "@/components/DashboardHeaderStat";
import { supabase } from "@/integrations/supabase/client";
import { leagueLevelOf } from "@/lib/level";

/**
 * Dashboard header cell: the student's place in this week's league (same
 * weekly_league ranking and query key as the league page), or an invitation to
 * join. Uses a medal (ranking) icon: the trophy already marks the weekly goal in
 * "Your learning rhythm", and the league artwork stays on the league page.
 */
type LeagueProfile = { id: string; level: string | null; max_level?: string | null };

/** This week's league standing, from the same weekly_league query as the league page. */
export function useWeeklyLeagueStanding(profile: LeagueProfile | null | undefined) {
  const { data: rows } = useQuery({
    queryKey: ["weekly-league", profile?.id, profile ? leagueLevelOf(profile) : null],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const me = rows?.find((row) => row.is_me);
  return {
    loaded: !!rows,
    joined: !!me?.joined,
    rank: me?.rank_position ?? null,
    xp: me?.xp ?? 0,
    total: rows?.filter((row) => row.joined).length ?? 0,
  };
}

export function WeeklyLeagueSummary({
  profile,
  translate,
}: {
  profile: LeagueProfile;
  translate: (label: string) => string;
}) {
  const { joined, total, rank, xp } = useWeeklyLeagueStanding(profile);

  return (
    <DashboardHeaderStat
      icon={<Medal className="size-6" strokeWidth={2.2} />}
      tone="amber"
      label={translate("Weekly league")}
      value={
        joined
          ? total > 1
            ? `#${rank ?? "–"} ${translate("of")} ${total}`
            : `${xp} XP`
          : translate("Join the league")
      }
      detail={
        joined
          ? total > 1
            ? `${xp} XP ${translate("this week")}`
            : translate("Leading this week")
          : translate("Compete with students at your level")
      }
      to="/league"
    />
  );
}
