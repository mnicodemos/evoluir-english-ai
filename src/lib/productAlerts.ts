// Product goals the owner acts on, shown with the other Admin alerts: the
// numbers that say where to work next. Warnings only (never a push), and only
// once enough students were measured for the number to mean something.

import type { OpsAlert } from "@/lib/opsAlerts";
import type { Rate } from "@/lib/retention";
import type { StageSummary } from "@/lib/speakingTiming";

export const GOALS = {
  /** EVO's first sound after the student stops speaking (median). */
  speakingWaitMedianMs: 3_000,
  /** The slowest 10% of answers. */
  speakingWaitP90Ms: 6_000,
  /** Answers measured before the wait is judged. */
  minAnswers: 20,
  /** Students back the day after signing up. */
  d1Percent: 30,
  /** New students who spoke to EVO on their first day. */
  firstDayTalkPercent: 50,
  /** Students measured before a rate is judged. */
  minStudents: 10,
} as const;

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

function judged(rate: Rate | undefined): rate is Rate & { percent: number } {
  return !!rate && rate.percent !== null && rate.eligible >= GOALS.minStudents;
}

export function productAlerts(input: {
  speakingWait: { answers: number; firstAudio: StageSummary } | null;
  d1?: Rate;
  firstDayTalk?: Rate | null;
}): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const wait = input.speakingWait;
  if (wait && wait.answers >= GOALS.minAnswers) {
    const { medianMs, p90Ms } = wait.firstAudio;
    if (medianMs !== null && medianMs > GOALS.speakingWaitMedianMs) {
      alerts.push({
        level: "warning",
        area: "product",
        title: `AI Speaking: a EVO leva ${seconds(medianMs)} para falar (meta: até 3 s)`,
        detail: `Mediana de ${wait.answers} respostas em 7 dias, do fim da fala do aluno ao primeiro som.`,
      });
    } else if (p90Ms !== null && p90Ms > GOALS.speakingWaitP90Ms) {
      alerts.push({
        level: "warning",
        area: "product",
        title: `AI Speaking: 10% das respostas esperam mais de ${seconds(p90Ms)} (meta: até 6 s)`,
        detail: "A mediana está boa; o problema está nas respostas mais lentas.",
      });
    }
  }
  if (judged(input.d1) && input.d1.percent < GOALS.d1Percent) {
    alerts.push({
      level: "warning",
      area: "product",
      title: `Só ${input.d1.percent}% dos alunos voltam no dia seguinte (meta: 30%)`,
      detail: `${input.d1.returned} de ${input.d1.eligible} alunos recentes. Veja a aba Retenção.`,
    });
  }
  const talk = input.firstDayTalk ?? undefined;
  if (judged(talk) && talk.percent < GOALS.firstDayTalkPercent) {
    alerts.push({
      level: "warning",
      area: "product",
      title: `Só ${talk.percent}% dos alunos novos falam com a EVO no 1º dia (meta: 50%)`,
      detail: `${talk.returned} de ${talk.eligible}. O caminho do cadastro à primeira conversa precisa de atenção.`,
    });
  }
  return alerts;
}
