import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { leagueLevelOf } from "@/lib/level";

/**
 * Dashboard header slot: the student's place in this week's league (same
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
  const { data: rows, isError } = useQuery({
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

  let title: string;
  let detail: string;
  if (isError || !rows) {
    title = translate("Weekly league");
    detail = translate("See this week's ranking");
  } else if (!joined) {
    title = translate("Weekly league");
    detail = translate("Join and compete this week");
  } else {
    title = `#${me?.rank_position ?? "–"} ${translate("of")} ${total}`;
    detail = `${me?.xp ?? 0} XP · ${translate("Weekly league")}`;
  }

  return (
    <Link
      to="/league"
      className="group flex h-full min-w-0 items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-green/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
    >
      <Trophy
        className="size-[2.1rem] shrink-0 text-amber-400"
        strokeWidth={2.2}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold leading-tight sm:text-base">
          {title}
        </p>
        <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">
          {detail}
        </p>
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
