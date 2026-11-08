import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History, Loader2, TrendingUp, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import evoLeagueSymbol from "@/assets/evo-liga-simbolo.webp";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { ProofOfProgressMission } from "@/components/league/ProofOfProgressMission";
import { useWeeklyLeagueStanding, weekXpLine } from "@/components/WeeklyLeagueSummary";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHomeImages } from "@/hooks/useHomeImages";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { findLevel, leagueLevelOf } from "@/lib/level";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";
import { rankingOpen, weekXpRising, type WeekXpSummary } from "@/lib/weekXp";

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
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  // The owner can change it in Admin → Conteúdo → Home images (owner request,
  // 2026-11-01); the built-in artwork stays as the fallback.
  const { data: homeImages } = useHomeImages();
  const leagueImage = homeImages?.league ?? evoLeagueSymbol;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const {
    data: rows = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["weekly-league", profile?.id, profile ? leagueLevelOf(profile) : null],
    enabled: !!profile?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return data ?? [];
    },
  });

  const me = rows.find((row) => row.is_me);
  const joined = me?.joined ?? profile?.league_opt_in ?? false;
  const ranking = rows.filter((row) => row.joined);
  // Your week until the league has enough students for a ranking (product review, 2026-10-31).
  const { week } = useWeeklyLeagueStanding(profile);
  const showRanking = rankingOpen(ranking.length);

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
      queryClient.invalidateQueries({ queryKey: ["weekly-league-history"] }),
      queryClient.invalidateQueries({ queryKey: ["week-xp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
    ]);
  }

  return (
    <AppShell mobileOneScreen>
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <header className="animate-rise flex items-center justify-between gap-3 lg:col-span-2">
          <img
            src={leagueImage}
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
                aria-label={t("How to earn XP")}
              >
                <Trophy className="size-4 text-amber-400" />
                <span>{t("How to earn XP")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 border-white/10 bg-[#101820] p-4 text-foreground"
            >
              <h2 className="font-display text-sm font-semibold">{t("How to earn XP")}</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {XP_RULES.map((rule) => (
                  <li key={rule.label} className="flex justify-between gap-3">
                    <span>{t(rule.label)}</span>
                    <span className="shrink-0 font-semibold text-foreground">+{rule.xp}</span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </header>

        <div className="lg:col-span-2">
          <ProofOfProgressMission />
        </div>

        {/* Left column: this week, the ranking and the history under them
            (owner request, 2026-11-02: the history filled the empty space under
            Weekly XP instead of lengthening the right column). */}
        <div className="space-y-3 lg:space-y-4">
          {!showRanking && !isLoading && !loadError ? <YourWeek week={week} /> : null}

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
                  src={leagueImage}
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
        </div>

        <aside className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          <section className="card-soft space-y-2 p-4">
            <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-brand-green" />
              Your participation
            </h2>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("Your rank")}</p>
                <p className="truncate text-sm font-semibold">
                  {joined ? me?.display_name || t("Your profile") : t("Not ranked")}
                </p>
              </div>
              <p className="shrink-0 font-display text-2xl font-bold tabular-nums text-brand-green">
                {joined && me?.rank_position != null ? `#${me.rank_position}` : "—"}
              </p>
            </div>
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
        </aside>
      </div>
    </AppShell>
  );
}

/**
 * Your week (product review, 2026-10-31): with few students per level a ranking
 * only says "you are alone", so the student's own XP against last week and their
 * best week leads the page until the league reaches RANKING_MIN_MEMBERS.
 */
function YourWeek({ week }: { week: WeekXpSummary }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const rising = weekXpRising(week);
  return (
    <section className="card-soft space-y-3 p-4 sm:p-5">
      <h2 className="font-display flex items-center gap-2 text-base font-semibold sm:text-lg">
        <TrendingUp
          className={cn("size-4 sm:size-5", rising ? "text-brand-green" : "text-muted-foreground")}
        />
        {t("Weekly XP")}
      </h2>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold tabular-nums">{week.thisWeek}</span>
        <span className="text-sm text-muted-foreground">{t("XP this week")}</span>
      </p>
      <p className={cn("text-sm font-medium", rising ? "text-brand-green" : "")}>
        {weekXpLine(week, t)}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <dt className="text-xs text-muted-foreground">{t("Last week")}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {week.known ? `${week.lastWeek} XP` : "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <dt className="text-xs text-muted-foreground">{t("Your best week")}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {week.known ? `${Math.max(week.best, week.thisWeek)} XP` : "—"}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {t("Beat your own last week: every lesson, text, conversation and review adds XP.")}
      </p>
    </section>
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
 * changes over time): the last 30 days, grouped by week, newest first, with the XP as a bar and
 * the position among the students who take part (weekly_league_history,
 * migration 0078). Hidden until that migration is applied.
 */
function LeagueHistory({ userId, joined }: { userId: string | null; joined: boolean }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["weekly-league-history", userId, joined],
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      // Not in the generated Supabase types until Lovable regenerates them.
      // Bound: an unbound supabase.rpc loses its client and throws (owner
      // report, 2026-11-02: Last week read 0, then "—", and Your history hid).
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        name: string,
        args: { p_weeks: number },
      ) => Promise<{ data: HistoryRow[] | null; error: { message: string } | null }>;
      const { data: rows, error } = await rpc("weekly_league_history", { p_weeks: 5 });
      if (error) throw error;
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - 30);
      return (rows ?? []).filter(
        (row) => new Date(`${row.week_start}T00:00:00`).getTime() >= cutoff.getTime(),
      );
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
        <div
          className="mt-4 grid h-36 items-end gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))`,
          }}
          role="img"
          aria-label={t("Weekly XP history bar chart")}
        >
          {rows.map((row, index) => (
            <div
              key={row.week_start}
              className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">{row.xp}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-md bg-amber-400/80 transition-all",
                    index === 0 && "bg-brand-green",
                  )}
                  style={{
                    height: `${Math.max(row.xp > 0 ? 8 : 2, Math.round((row.xp / maxXp) * 100))}%`,
                  }}
                  title={`${weekLabel(row.week_start)}: ${row.xp} XP`}
                />
              </div>
              <span
                className={cn(
                  "max-w-full truncate text-[10px]",
                  index === 0 ? "font-semibold text-brand-green" : "text-muted-foreground",
                )}
              >
                {index === 0 ? t("Now") : weekLabel(row.week_start)}
              </span>
              <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                {row.rank_position !== null && row.xp > 0
                  ? `#${row.rank_position}/${row.members}`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
      {!joined ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("Join the league to see your position each week.")}
        </p>
      ) : null}
    </section>
  );
}
