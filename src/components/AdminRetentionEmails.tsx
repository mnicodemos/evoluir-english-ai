import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listRetentionEmailDeliveries } from "@/lib/admin.functions";
import { useUiLang } from "@/lib/uiLang";

const MILESTONES = [2, 4, 7, 14, 30] as const;

export function AdminRetentionEmails() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const list = useServerFn(listRetentionEmailDeliveries);
  const query = useQuery({
    queryKey: ["admin-retention-email-deliveries"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });
  const labels: Record<string, string> = {
    scheduled: pt ? "Agendado" : "Scheduled",
    pending: pt ? "Processando" : "Pending",
    sent: pt ? "Aceito pelo provedor" : "Accepted by provider",
    delivered: pt ? "Entregue" : "Delivered",
    opened: pt ? "Aberto" : "Opened",
    clicked: pt ? "Clicado" : "Clicked",
    suppressed: pt ? "Suprimido" : "Suppressed",
    failed: pt ? "Falhou" : "Failed",
  };
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleString(pt ? "pt-BR" : "en-US") : "—";

  return (
    <section className="card-soft mt-5 space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{pt ? "Retenção e lembretes" : "Retention and reminders"}</h3>
          <p className="text-sm text-muted-foreground">
            {pt
              ? "Acompanhamento dos e-mails por inatividade: 2, 4, 7, 14 e 30 dias."
              : "Email tracking by inactivity: 2, 4, 7, 14, and 30 days."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {pt ? "Atualizar" : "Refresh"}
        </Button>
      </div>

      {query.isPending ? (
        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {pt ? "Carregando envios..." : "Loading deliveries..."}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">
          {pt ? "Não foi possível carregar o histórico de retenção." : "Could not load retention history."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [pt ? "Registros" : "Records", query.data.counts.total ?? 0],
              [pt ? "Enviados" : "Sent", query.data.counts.sent ?? 0],
              [pt ? "Entregues" : "Delivered", query.data.counts.delivered ?? 0],
              [pt ? "Falhas" : "Failed", query.data.counts.failed ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{pt ? "Marcos:" : "Milestones:"}</span>
            {MILESTONES.map((day) => (
              <span key={day} className="rounded-full border px-2 py-1">{day}{pt ? " dias" : " days"}</span>
            ))}
          </div>
          {query.data.deliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <p className="font-medium">{pt ? "Nenhum envio de retenção registrado" : "No retention emails recorded"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pt
                  ? "A visão está pronta para monitorar os envios quando a rotina de reativação for ativada. Nenhum e-mail é disparado por esta tela."
                  : "This view is ready to monitor deliveries when the reactivation workflow is enabled. This screen does not send emails."}
              </p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-2">{pt ? "Aluno" : "Student"}</th>
                    <th className="py-2 pr-2">{pt ? "Marco" : "Milestone"}</th>
                    <th className="py-2 pr-2">{pt ? "Status" : "Status"}</th>
                    <th className="py-2 pr-2">{pt ? "Agendado" : "Scheduled"}</th>
                    <th className="py-2 pr-2">{pt ? "Enviado" : "Sent"}</th>
                    <th className="py-2 pr-2">{pt ? "Entregue" : "Delivered"}</th>
                    <th className="py-2">{pt ? "Detalhe" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.deliveries.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{row.student_name}</p>
                        <p className="text-xs text-muted-foreground">{row.recipient_email}</p>
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap">{row.milestone_days}{pt ? " dias" : " days"}</td>
                      <td className="py-2 pr-2">{labels[row.status] ?? row.status}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">{date(row.scheduled_at)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">{date(row.sent_at)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">{date(row.delivered_at)}</td>
                      <td className="py-2 text-xs text-destructive">{row.last_error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
