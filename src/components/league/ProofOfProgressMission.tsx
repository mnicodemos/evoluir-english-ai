import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Headphones, LockKeyhole } from "lucide-react";

import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

const REQUIRED_PARTS = 3;
const PASS_SCORE = 70;

/** Monday 00:00 in America/Sao_Paulo, converted to an ISO instant. */
function leagueWeekStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const localMonday = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
  // São Paulo is UTC-03:00. Construct the local Monday boundary as an instant.
  return new Date(`${localMonday}T03:00:00.000Z`).toISOString();
}

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
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("activities")
        .select("id, created_at, score")
        .eq("user_id", profile!.id)
        .eq("activity_type", "listening")
        .gte("created_at", weekStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []).map((row) => ({
        id: row.id,
        score: typeof row.score === "number" ? row.score : null,
      }));
    },
  });

  const qualified = (data ?? []).filter((row) => row.score !== null && row.score >= PASS_SCORE);
  const completed = Math.min(REQUIRED_PARTS, qualified.length);
  const done = completed >= REQUIRED_PARTS;

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
            Language Arena · Proof of Progress
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
          {isLoading ? "—" : `${completed}/${REQUIRED_PARTS}`}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={portuguese ? "Progresso da missão" : "Mission progress"}
        aria-valuemin={0}
        aria-valuemax={REQUIRED_PARTS}
        aria-valuenow={completed}
      >
        <div
          className={cn("h-full rounded-full bg-brand-green transition-[width]", done ? "w-full" : "")}
          style={{ width: `${(completed / REQUIRED_PARTS) * 100}%` }}
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
            ? (portuguese ? "Verificando atividades salvas…" : "Checking saved activities…")
            : portuguese
              ? `${completed} de 3 partes qualificadas. A missão usa resultados salvos; não concede XP extra.`
              : `${completed} of 3 qualifying parts. This mission uses saved results and grants no bonus XP.`}
        </p>
      )}
    </section>
  );
}
