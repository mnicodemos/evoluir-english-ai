import { useQuery } from "@tanstack/react-query";
import { Medal, TrendingUp } from "lucide-react";

import { DashboardHeaderStat } from "@/components/DashboardHeaderStat";
import { supabase } from "@/integrations/supabase/client";
import { leagueLevelOf } from "@/lib/level";
import { rankingOpen, weekXpSummary } from "@/lib/weekXp";

/**
 * Dashboard header cell: "Your week" (product review, 2026-10-31), the
 * student's XP this week against last week, until their league has enough
 * students for a ranking (rankingOpen); then their place in this week's league
 * (same weekly_league ranking and query key as the league page). Uses a medal
 * for the ranking: the trophy already marks the weekly goal in "Your learning
 * rhythm", and the league artwork stays on the league page.
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
  // The student's own weeks (weekly_league_history, migration 0078), for Your week.
  const { data: weeks } = useQuery({
    queryKey: ["week-xp-history", profile?.id],
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Not in the generated Supabase types until Lovable regenerates them.
      const rpc = supabase.rpc as unknown as (
        name: string,
        args: { p_weeks: number },
      ) => Promise<{ data: { xp: number }[] | null; error: { message: string } | null }>;
      const { data, error } = await rpc("weekly_league_history", { p_weeks: 8 });
      if (error) throw error;
      return data ?? [];
    },
  });
  const me = rows?.find((row) => row.is_me);
  const xp = me?.xp ?? 0;
  const total = rows?.filter((row) => row.joined).length ?? 0;
  const joined = !!me?.joined;
  return {
    loaded: !!rows,
    joined,
    rank: me?.rank_position ?? null,
    xp,
    total,
    /** Whether the ranking among students is shown (joined, and enough students). */
    ranked: joined && rankingOpen(total),
    week: weekXpSummary(weeks ?? [], rows ? xp : undefined),
  };
}

/** One line on Your week: against last week, or how XP is earned before there is one. */
export function weekXpLine(
  week: { lastWeek: number; delta: number; record: boolean },
  translate: (label: string) => string,
): string {
  if (week.record) return translate("Your best week so far");
  if (week.lastWeek <= 0) return translate("Every activity earns XP");
  if (week.delta >= 0) return `+${week.delta} XP ${translate("vs last week")}`;
  return `${-week.delta} XP ${translate("to beat last week")}`;
}

export type LeagueMedal = "gold" | "silver" | "bronze" | "grey";

/** The medal's colour follows the place (user request): 1st gold, 2nd silver,
 *  3rd bronze, any other place (or not in the league yet) grey. */
export function leagueMedal(standing: { joined: boolean; rank: number | null }): LeagueMedal {
  if (!standing.joined) return "grey";
  if (standing.rank === 1) return "gold";
  if (standing.rank === 2) return "silver";
  if (standing.rank === 3) return "bronze";
  return "grey";
}

/** Text colour of the medal icon alone (the phone chip). */
export const LEAGUE_MEDAL_TEXT: Record<LeagueMedal, string> = {
  gold: "text-amber-400",
  silver: "text-slate-300",
  bronze: "text-[#cd7f32]",
  grey: "text-muted-foreground",
};

export function WeeklyLeagueSummary({
  profile,
  translate,
}: {
  profile: LeagueProfile;
  translate: (label: string) => string;
}) {
  const { total, rank, xp, joined, ranked, week } = useWeeklyLeagueStanding(profile);

  if (!ranked) {
    return (
      <DashboardHeaderStat
        icon={<TrendingUp className="size-6" strokeWidth={2.2} />}
        tone={week.lastWeek > 0 && week.delta >= 0 ? "green" : "grey"}
        label={translate("Weekly XP")}
        value={`${week.thisWeek} XP`}
        detail={weekXpLine(week, translate)}
        to="/league"
      />
    );
  }

  return (
    <DashboardHeaderStat
      icon={<Medal className="size-6" strokeWidth={2.2} />}
      tone={leagueMedal({ joined, rank })}
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
