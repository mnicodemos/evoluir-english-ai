import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { findLevel } from "@/lib/level";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/league")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Weekly league" },
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
    queryKey: ["weekly-league", profile?.id, profile?.level],
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
        <header className="animate-rise lg:col-span-2">
          <h1 className="text-lg font-bold lg:text-3xl">Weekly league</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span>{profile ? findLevel(profile.level).label : ""}</span> ·{" "}
            <span>Monday to Sunday · resets every Monday</span>
          </p>
        </header>

        <section className="card-soft space-y-2 p-3 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
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
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No one at your level joined the league this week yet.
            </p>
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
        </section>

        <aside className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          <section className="card-soft space-y-2 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
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

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">How to earn XP</h2>
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
