import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getSpeakingWait } from "@/lib/admin.functions";
import type { StageSummary } from "@/lib/speakingTiming";

function seconds(ms: number | null) {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/**
 * Admin: the silence a student hears after answering in AI Speaking, per
 * stage, measured in the browser. The first sound is what the student feels.
 */
export function AdminSpeakingWait() {
  const load = useServerFn(getSpeakingWait);
  const query = useQuery({ queryKey: ["admin", "speaking-wait"], queryFn: () => load() });
  if (query.isPending || query.isError) return null;
  if (query.data === null) {
    return (
      <p className="mt-4 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        Espera no AI Speaking: aplique a migração 0050_speaking_turn_timings pelo chat do Lovable
        para começar a medir.
      </p>
    );
  }
  const summary = query.data;
  const stages: Array<{ label: string; stage: StageSummary; main?: boolean }> = [
    { label: "Primeira palavra da EVO (som)", stage: summary.firstAudio, main: true },
    { label: "Primeiro texto da resposta", stage: summary.firstText },
    { label: "Transcrição da fala", stage: summary.transcribed },
  ];
  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label="Espera no AI Speaking"
    >
      <p className="text-sm font-semibold">Espera no AI Speaking (7 dias)</p>
      <p className="text-xs text-muted-foreground">
        Do momento em que o aluno para de falar · {summary.answers} respostas medidas
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {stages.map(({ label, stage, main }) => (
          <div
            key={label}
            className={`rounded-lg border p-3 ${main ? "border-brand-green/40 bg-brand-green/5" : "border-border"}`}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{seconds(stage.medianMs)}</p>
            <p className="text-[11px] text-muted-foreground">
              mediana · 10% mais lentos: {seconds(stage.p90Ms)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
