import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listEmailCampaignRecipients, sendAdminStudentEmail } from "@/lib/admin.functions";
import { useUiLang } from "@/lib/uiLang";

export function AdminEmailCampaigns() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const queryClient = useQueryClient();
  const list = useServerFn(listEmailCampaignRecipients);
  const send = useServerFn(sendAdminStudentEmail);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const recipients = useQuery({
    queryKey: ["admin-email-campaign-recipients"],
    queryFn: () => list(),
  });
  const statusLabel = (status: { status: string; sent_at: string | null } | null) => {
    if (!status) return pt ? "Não enviado" : "Not sent";
    const labels: Record<string, string> = {
      pending: pt ? "Processando" : "Pending",
      sent: pt ? "Enviado" : "Sent",
      suppressed: pt ? "Suprimido" : "Suppressed",
      failed: pt ? "Falhou" : "Failed",
    };
    const date = status.sent_at ? new Date(status.sent_at).toLocaleString(pt ? "pt-BR" : "en-US") : "";
    return date ? `${labels[status.status] ?? status.status} · ${date}` : labels[status.status] ?? status.status;
  };
  const filtered = (recipients.data ?? []).filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  async function sendEmail(userId: string, campaign: "welcome" | "premium-benefits") {
    const key = `${userId}:${campaign}`;
    setSending(key);
    try {
      const result = await send({ data: { userId, campaign, lang } });
      if (result.sent) toast.success(pt ? "E-mail enviado." : "Email sent.");
      else toast.info(pt ? "Destinatário suprimido pelo serviço de e-mail." : "Recipient suppressed by email service.");
    } catch (error) {
      toast.error(pt ? "Não foi possível enviar o e-mail." : "Could not send the email.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-email-campaign-recipients"] });
    }
  }

  return (
    <section className="card-soft space-y-4 p-3 sm:p-5">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">{pt ? "Campanhas por e-mail" : "Email campaigns"}</h2>
          <p className="text-sm text-muted-foreground">
            {pt ? "Envie boas-vindas ou apresente os benefícios do Premium individualmente." : "Send a welcome or Premium benefits email to an individual student."}
          </p>
        </div>
      </div>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={pt ? "Buscar aluno por nome ou e-mail" : "Search student by name or email"}
      />
      {recipients.isPending ? (
        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{pt ? "Carregando alunos..." : "Loading students..."}</div>
      ) : recipients.isError ? (
        <p className="text-sm text-destructive">{pt ? "Não foi possível carregar os alunos." : "Could not load students."}</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-2">{pt ? "Aluno" : "Student"}</th>
                <th className="py-2 pr-2">{pt ? "Plano" : "Plan"}</th>
                <th className="py-2">{pt ? "Ações" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="py-2 pr-2 text-xs">{user.plan === "premium" ? "Premium" : "Free"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" disabled={sending !== null} onClick={() => void sendEmail(user.id, "welcome")}>
                        {sending === `${user.id}:welcome` ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                        <span>{pt ? "Boas-vindas" : "Welcome"}</span>
                      </Button>
                      <Button size="sm" variant="outline" disabled={sending !== null || user.plan === "premium"} onClick={() => void sendEmail(user.id, "premium-benefits")}>
                        {sending === `${user.id}:premium-benefits` ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
                        <span>{pt ? "Premium" : "Premium"}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">{pt ? "Nenhum aluno encontrado." : "No students found."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
