import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { getOpsAlerts } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { useUiLang } from "@/lib/uiLang";

const KIND_LABEL: Record<string, string> = {
  word: "Daily word",
  reminder: "Reminder",
  weekly: "Weekly report",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin "Alerts" box: failed or missing scheduled pushes and AI calls failing
 * in the last 24 h. The same rules send the admins a push every morning when
 * something needs attention.
 */
export function AdminAlerts() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const load = useServerFn(getOpsAlerts);
  const query = useQuery({ queryKey: ["admin", "ops-alerts"], queryFn: () => load() });
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        {pt ? "Não foi possível carregar os alertas." : "Could not load alerts."}
      </p>
    );
  }
  const { alerts, recentRuns } = query.data;
  const errors = alerts.filter((alert) => alert.level === "error").length;
  const lastRun = recentRuns[0];

  return (
    <section
      aria-label={pt ? "Alertas" : "Alerts"}
      className={cn(
        "mt-3 rounded-xl border p-3 sm:p-4",
        errors
          ? "border-destructive/50 bg-destructive/10"
          : alerts.length
            ? "border-warning/40 bg-warning/10"
            : "border-brand-green/30 bg-brand-green/5",
      )}
    >
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CircleCheck className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
          {pt ? "Tudo funcionando: notificações push e IA sem falhas nas últimas 24 h." : "All systems operational: no push notification or AI failures in the last 24 hours."}
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              {alert.level === "error" ? (
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block font-medium">{alert.title}</span>
                <span className="block break-words text-xs text-muted-foreground">
                  {alert.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {lastRun && (
        <p className="mt-2 text-xs text-muted-foreground">
          {pt ? "Última notificação:" : "Last notification:"} {KIND_LABEL[lastRun.kind] ?? lastRun.kind} {pt ? "em" : "at"} {when(lastRun.created_at)} ·{" "}
          {lastRun.sent} {pt ? "de" : "of"} {lastRun.devices} {pt ? "dispositivo(s)" : "device(s)"}
          {lastRun.removed ? ` · ${lastRun.removed} ${pt ? "token(s) expirado(s) removido(s)" : "expired token(s) removed"}` : ""}
        </p>
      )}
    </section>
  );
}
