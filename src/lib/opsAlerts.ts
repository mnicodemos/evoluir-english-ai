// Failure alerts for the owner: scheduled pushes that failed or did not run,
// and AI calls failing. Pure rules, shared by the Admin "Alerts" box and the
// morning alert push to admins, so both always say the same thing.

export type PushRun = {
  kind: string;
  created_at: string;
  devices: number;
  sent: number;
  failed: number;
  error: string | null;
};

export type AiCall = {
  operation: string;
  created_at: string;
  success: boolean | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
};

export type OpsAlert = {
  level: "error" | "warning";
  area: "push" | "ai" | "product" | "server";
  title: string;
  detail: string;
};

/** A daily job that has not run for this long missed at least one run. */
const MISSED_RUN_MS = 26 * 60 * 60 * 1000;
const AI_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The student's side, not a system failure: page closed, or silence recorded. */
const NOT_SYSTEM_FAILURES = new Set(["abandoned", "empty_transcript"]);
/** Refused by the usage guards (one request at a time, rate, daily limit) before
 *  reaching the AI: the guard working, not a failure. */
const GUARD_REFUSED = "denied";

const PUSH_JOBS = [
  { label: "Palavra do dia (9h)", kinds: ["word"] },
  // On Sunday the evening job sends the weekly report instead of the reminder.
  { label: "Lembrete de estudo (19h)", kinds: ["reminder", "weekly"] },
] as const;

function hoursAgo(iso: string, now: Date) {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000));
}

export function pushAlerts(runs: PushRun[], now: Date): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  for (const job of PUSH_JOBS) {
    const last = runs
      .filter((run) => (job.kinds as readonly string[]).includes(run.kind))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!last) {
      alerts.push({
        level: "warning",
        area: "push",
        title: `${job.label}: nenhuma execução registrada`,
        detail: "O registro começa na próxima execução agendada.",
      });
      continue;
    }
    if (now.getTime() - new Date(last.created_at).getTime() > MISSED_RUN_MS) {
      alerts.push({
        level: "error",
        area: "push",
        title: `${job.label}: não roda há ${hoursAgo(last.created_at, now)} h`,
        detail: "Confira o job no pg_cron (cron.job_run_details e net._http_response).",
      });
    }
    if (last.error) {
      alerts.push({
        level: "error",
        area: "push",
        title: `${job.label}: a última execução falhou`,
        detail: last.error.slice(0, 200),
      });
    } else if (last.failed > 0 && last.sent === 0) {
      alerts.push({
        level: "error",
        area: "push",
        title: `${job.label}: nenhum aparelho recebeu`,
        detail: `${last.failed} envio(s) recusado(s) pelo Firebase.`,
      });
    } else if (last.failed > 0) {
      alerts.push({
        level: "warning",
        area: "push",
        title: `${job.label}: ${last.failed} envio(s) falharam`,
        detail: `${last.sent} de ${last.devices} aparelho(s) receberam.`,
      });
    }
  }
  return alerts;
}

export function aiAlerts(calls: AiCall[], now: Date): OpsAlert[] {
  const since = now.getTime() - AI_WINDOW_MS;
  const byOperation = new Map<string, { total: number; failed: AiCall[] }>();
  for (const call of calls) {
    if (new Date(call.created_at).getTime() < since) continue;
    if (call.status === "pending" || call.status === GUARD_REFUSED) continue;
    const entry = byOperation.get(call.operation) ?? { total: 0, failed: [] };
    entry.total += 1;
    if (call.success === false && !NOT_SYSTEM_FAILURES.has(call.error_code ?? "")) {
      entry.failed.push(call);
    }
    byOperation.set(call.operation, entry);
  }
  const alerts: OpsAlert[] = [];
  for (const [operation, { total, failed }] of byOperation) {
    if (failed.length === 0) continue;
    const rate = failed.length / total;
    const latest = failed.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;
    const reason = latest.error_message || latest.error_code || "erro sem mensagem";
    alerts.push({
      level: failed.length >= 3 && rate >= 0.25 ? "error" : "warning",
      area: "ai",
      title: `IA (${operation}): ${failed.length} de ${total} chamadas falharam em 24 h`,
      detail: `Último erro: ${reason.slice(0, 200)}`,
    });
  }
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}

export function opsAlerts(input: { pushRuns: PushRun[]; aiCalls: AiCall[]; now?: Date }) {
  const now = input.now ?? new Date();
  return [...pushAlerts(input.pushRuns, now), ...aiAlerts(input.aiCalls, now)];
}

/** One push for the admins' phones, or null when nothing needs attention. */
export function adminAlertPush(alerts: OpsAlert[]) {
  const errors = alerts.filter((alert) => alert.level === "error");
  if (errors.length === 0) return null;
  const first = errors[0]!;
  return {
    title: errors.length === 1 ? "⚠️ Evoluir+: 1 alerta" : `⚠️ Evoluir+: ${errors.length} alertas`,
    body: errors.length === 1 ? first.title : `${first.title} · e mais ${errors.length - 1}`,
    path: "/admin",
  };
}
