import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History, Loader2, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import evoLeagueSymbol from "@/assets/evo-liga-simbolo.webp";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { findLevel, leagueLevelOf } from "@/lib/level";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/league")({
  head: () => ({
    meta: [
      { title: "Weekly league - Evoluir+ English AI" },
      { name: "description", content: "Weekly ranking of the students at your level." },
    ],
  }),
  component: League,
});

/** Mirrors the XP rule in public.league_week_xp (migration 0039). */
const XP_RULES = [
  { label: "Lesson completed", xp: 50 },
  { label: "Writing, Listening or Speaking session", xp: 20 },
  { label: "Daily goal met", xp: 30 },
  { label: "Mistake reviewed", xp: 5 },
  { label: "Word reviewed", xp: 2 },
] as const;

function League() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const {
    data: rows = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["weekly-league", profile?.id, profile ? leagueLevelOf(profile) : null],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return data ?? [];
    },
  });

  const me = rows.find((row) => row.is_me);
  const joined = me?.joined ?? profile?.league_opt_in ?? false;
  const ranking = rows.filter((row) => row.joined);

  async function setJoined(value: boolean) {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ league_opt_in: value })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      // The database message tells a missing migration apart from a permission problem.
      toast.error("Could not update your league participation.", { description: error.message });
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weekly-league"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
    ]);
  }

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <header className="animate-rise flex items-center gap-3 lg:col-span-2">
          <img
            src={evoLeagueSymbol}
            alt=""
            width={320}
            height={320}
            className="size-14 shrink-0 rounded-full object-cover lg:size-20"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold lg:text-3xl">Weekly league</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span>{profile ? findLevel(leagueLevelOf(profile)).label : ""}</span> ·{" "}
              <span>Monday to Sunday · resets every Monday</span>
            </p>
          </div>
        </header>

        <section className="card-soft space-y-2 p-3 sm:p-5">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Trophy className="size-4 text-amber-400 sm:size-5" />
            Ranking
          </h2>
          {loadError ? (
            <p className="py-6 text-center text-sm text-destructive">
              <span>The league is not available right now.</span>{" "}
              <span className="block text-xs text-muted-foreground">
                {(loadError as { message?: string }).message ?? ""}
              </span>
            </p>
          ) : isLoading ? (
            <div className="space-y-2 py-1" aria-busy="true">
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <img
                src={evoLeagueSymbol}
                alt="EVO, a mascote da liga"
                width={320}
                height={320}
                loading="lazy"
                className="size-40 rounded-full object-cover"
              />
              <p className="text-sm text-muted-foreground">
                No one at your level joined the league this week yet.
              </p>
              {!joined && (
                <p className="text-sm font-medium text-foreground">
                  Join now and be the first in the ranking!
                </p>
              )}
            </div>
          ) : (
            <ol className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
              {ranking.map((row) => (
                <li
                  key={`${row.rank_position}-${row.display_name}-${row.is_me}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    row.is_me ? "border-brand-green/50 bg-brand-green/10" : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                      row.rank_position === 1
                        ? "bg-amber-400 text-black"
                        : row.rank_position === 2
                          ? "bg-slate-300 text-black"
                          : row.rank_position === 3
                            ? "bg-orange-400 text-black"
                            : "bg-secondary",
                    )}
                  >
                    {row.rank_position}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {row.display_name || "—"}
                    {row.is_me && <span className="ml-1 text-xs text-brand-green">(you)</span>}
                  </span>
                  <span className="font-display font-bold">{row.xp} XP</span>
                </li>
              ))}
            </ol>
          )}
          {/* Alone in the ranking: say why the others are not here (user report:
              the league groups students by level). */}
          {!isLoading && !loadError && ranking.length === 1 && ranking[0]?.is_me && (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              You are the only one in your level&apos;s league this week. Each level has its own
              league, so students at other levels compete in theirs.
            </p>
          )}
        </section>

        <aside className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          <section className="card-soft space-y-2 p-4">
            <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-brand-green" />
              Your participation
            </h2>
            <p className="text-sm">
              <span>This week</span>: <span className="font-bold">{me?.xp ?? 0} XP</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {joined
                ? "Other students at your level see your first name and initial, and your XP."
                : "You are not in the ranking. Join to appear with your first name and initial."}
            </p>
            <Button
              size="sm"
              variant={joined ? "outline" : "default"}
              disabled={saving || !profile}
              onClick={() => void setJoined(!joined)}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {joined ? "Leave the league" : "Join the league"}
            </Button>
          </section>

          <LeagueHistory userId={profile?.id ?? null} joined={joined} />

          <section className="card-soft p-4">
            <h2 className="font-display text-sm font-semibold">How to earn XP</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {XP_RULES.map((rule) => (
                <li key={rule.label} className="flex justify-between gap-3">
                  <span>{rule.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">+{rule.xp}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

type HistoryRow = {
  week_start: string;
  xp: number;
  rank_position: number | null;
  members: number | null;
};

/**
 * The student's league weeks (user request, 2026-10-22: see how the position
 * changes over time): the last 8 weeks, newest first, with the XP as a bar and
 * the position among the students who take part (weekly_league_history,
 * migration 0078). Hidden until that migration is applied.
 */
function LeagueHistory({ userId, joined }: { userId: string | null; joined: boolean }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["weekly-league-history", userId, joined],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Not in the generated Supabase types until Lovable regenerates them.
      const rpc = supabase.rpc as unknown as (
        name: string,
        args: { p_weeks: number },
      ) => Promise<{ data: HistoryRow[] | null; error: { message: string } | null }>;
      const { data: rows, error } = await rpc("weekly_league_history", { p_weeks: 8 });
      if (error) throw error;
      return rows ?? [];
    },
  });
  if (isError) return null;
  const rows = data ?? [];
  const maxXp = Math.max(1, ...rows.map((row) => row.xp));
  const ranked = rows.filter((row) => row.rank_position !== null && row.xp > 0);
  const best = ranked.length ? Math.min(...ranked.map((row) => row.rank_position!)) : null;
  const weekLabel = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
      day: "numeric",
      month: "short",
    });

  return (
    <section className="card-soft p-4">
      <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-brand-green" />
        {t("Your history")}
      </h2>
      {best !== null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <span>{t("Best position")}</span>:{" "}
          <span className="font-semibold text-foreground">#{best}</span>
        </p>
      ) : null}
      {isLoading ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((row, index) => (
            <li
              key={row.week_start}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs"
            >
              <span
                className={cn(
                  "text-muted-foreground",
                  index === 0 && "font-semibold text-brand-green",
                )}
              >
                {index === 0 ? t("This week") : weekLabel(row.week_start)}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-amber-400/80"
                    style={{ width: `${Math.round((row.xp / maxXp) * 100)}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums">{row.xp} XP</span>
              </span>
              <span className="w-14 text-right font-semibold tabular-nums">
                {row.rank_position !== null && row.xp > 0 ? (
                  <>
                    #{row.rank_position}
                    <span className="font-normal text-muted-foreground">/{row.members}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!joined ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("Join the league to see your position each week.")}
        </p>
      ) : null}
    </section>
  );
}
