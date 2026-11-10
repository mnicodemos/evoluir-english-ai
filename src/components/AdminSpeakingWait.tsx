import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useUiLang } from "@/lib/uiLang";
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
  const { lang } = useUiLang();
  const pt = lang === "pt";
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
    { label: pt ? "Primeira palavra da EVO (som)" : "EVO first spoken word", stage: summary.firstAudio, main: true },
    { label: pt ? "Primeiro texto da resposta" : "First response text", stage: summary.firstText },
    { label: pt ? "Transcrição da fala" : "Speech transcription", stage: summary.transcribed },
  ];
  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label={pt ? "Espera no AI Speaking" : "AI Speaking wait time"}
    >
      <p className="text-sm font-semibold">{pt ? "Espera no AI Speaking (7 dias)" : "AI Speaking wait time (7 days)"}</p>
      <p className="text-xs text-muted-foreground">
        {pt ? `Do momento em que o aluno para de falar · ${summary.answers} respostas medidas` : `From when the student stops speaking · ${summary.answers} measured responses`}
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
              {pt ? `mediana · 10% mais lentos: ${seconds(stage.p90Ms)}` : `median · slowest 10%: ${seconds(stage.p90Ms)}`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
