import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Headphones, LockKeyhole } from "lucide-react";

import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";
import {
  countQualifiedListeningParts,
  LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS,
  leagueWeekStartIso,
} from "@/lib/languageArenaProof";

/**
 * First Language Arena mission: three saved Listening parts scoring >=70%.
 * Evidence comes from persisted activity rows, not from an AI-generated claim.
 * It awards no new XP and does not change the existing learning rules.
 */
export function ProofOfProgressMission() {
  const { data: profile } = useProfile();
  const { lang } = useUiLang();
  const portuguese = lang === "pt";
  const weekStart = leagueWeekStartIso();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["language-arena-proof-listening", profile?.id, weekStart],
    enabled: !!profile?.id,
    staleTime: 30_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("activities")
        .select("id, created_at, score")
        .eq("user_id", profile!.id)
        .eq("activity_type", "listening")
        .gte("created_at", weekStart)
        .lt("created_at", new Date(Date.parse(weekStart) + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []).map((row) => ({
        id: row.id,
        score: typeof row.score === "number" ? row.score : null,
      }));
    },
  });

  const completed = countQualifiedListeningParts((data ?? []).map((row) => row.score));
  const done = completed >= LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS;

  return (
    <section className="card-soft space-y-3 p-4 sm:p-5" aria-labelledby="proof-of-progress-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/10">
          {done ? (
            <BadgeCheck className="size-5 text-brand-green" aria-hidden="true" />
          ) : (
            <Headphones className="size-5 text-brand-green" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
            {portuguese ? "Language Arena · Progresso comprovado" : "Language Arena · Proof of Progress"}
          </p>
          <h2 id="proof-of-progress-title" className="mt-1 font-display text-base font-semibold">
            {portuguese ? "Missão: Listening em prática" : "Mission: Listening in action"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {portuguese
              ? "Salve 3 partes de Listening nesta semana, cada uma com resultado de pelo menos 70%."
              : "Save 3 Listening parts this week, each with a score of at least 70%."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs font-semibold tabular-nums">
          {isLoading ? "—" : `${completed}/${LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS}`}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={portuguese ? "Progresso da missão" : "Mission progress"}
        aria-valuemin={0}
        aria-valuemax={LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS}
        aria-valuenow={completed}
      >
        <div
          className={cn(
            "h-full rounded-full bg-brand-green transition-[width]",
            done ? "w-full" : "",
          )}
          style={{ width: `${(completed / LANGUAGE_ARENA_LISTENING_REQUIRED_PARTS) * 100}%` }}
        />
      </div>

      {isError ? (
        <p role="status" className="text-xs text-destructive">
          {portuguese
            ? "Não foi possível carregar as evidências agora. Tente novamente mais tarde."
            : "Evidence could not be loaded right now. Please try again later."}
        </p>
      ) : done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-brand-green">
          <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
          {portuguese
            ? "Missão concluída com evidências salvas nesta semana."
            : "Mission complete — this week's evidence is saved."}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
          {isLoading
            ? portuguese
              ? "Verificando atividades salvas…"
              : "Checking saved activities…"
            : portuguese
              ? `${completed} de 3 partes qualificadas. A missão usa resultados salvos; não concede XP extra.`
              : `${completed} of 3 qualifying parts. This mission uses saved results and grants no bonus XP.`}
        </p>
      )}
    </section>
  );
}
