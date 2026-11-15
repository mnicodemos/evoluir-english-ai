import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminEmailInbox,
  startMicrosoftEmailConnection,
  syncAdminEmailInbox,
} from "@/lib/admin-email.functions";

export function AdminEmailInbox() {
  const queryClient = useQueryClient();
  const loadInbox = useServerFn(getAdminEmailInbox);
  const startConnection = useServerFn(startMicrosoftEmailConnection);
  const syncInbox = useServerFn(syncAdminEmailInbox);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const inbox = useQuery({
    queryKey: ["admin-email-inbox"],
    queryFn: () => loadInbox(),
    staleTime: 15_000,
    retry: false,
  });

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("emailConnection");
    if (!status) return;
    if (status === "connected") toast.success("Conta Microsoft conectada.");
    else toast.error("Não foi possível conectar a conta Microsoft.");
    const url = new URL(window.location.href);
    url.searchParams.delete("emailConnection");
    window.history.replaceState({}, "", url);
    void queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] });
  }, [queryClient]);

  const connect = async () => {
    setBusy("connect");
    try {
      const result = await startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar conexão Microsoft.");
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const result = await syncInbox();
      toast.success(`${result.synced} mensagem(ns) sincronizada(s).`);
      await queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar mensagens.");
    } finally {
      setBusy(null);
    }
  };

  const messages = inbox.data?.messages ?? [];
  const contact = messages.filter((message) => message.mailbox === "contact");
  const support = messages.filter((message) => message.mailbox === "support");

  return (
    <section className="card-soft space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Caixa de entrada</h2>
            <p className="text-xs text-muted-foreground">
              {inbox.data?.connected
                ? `Microsoft conectado: ${inbox.data.mailboxEmail}`
                : "Conecte a caixa Hotmail que recebe os encaminhamentos do ImprovMX."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {inbox.data?.connected ? (
            <Button size="sm" variant="outline" onClick={sync} disabled={busy !== null}>
              {busy === "sync" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Sincronizar
            </Button>
          ) : (
            <Button size="sm" onClick={connect} disabled={busy !== null}>
              {busy === "connect" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Conectar Hotmail
            </Button>
          )}
        </div>
      </div>

      {inbox.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando caixa de entrada…
        </div>
      ) : inbox.isError ? (
        <p className="py-4 text-sm text-destructive">Não foi possível carregar a caixa de entrada.</p>
      ) : !inbox.data?.connected ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          A conexão ainda não foi realizada. Ao conectar, a Microsoft solicitará autorização de leitura da caixa.
        </p>
      ) : (
        <Tabs defaultValue="contact">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">Contato ({contact.length})</TabsTrigger>
            <TabsTrigger value="support">Suporte ({support.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="contact" className="mt-3 space-y-2">
            <MessageList messages={contact} />
          </TabsContent>
          <TabsContent value="support" className="mt-3 space-y-2">
            <MessageList messages={support} />
          </TabsContent>
        </Tabs>
      )}
      <p className="text-xs text-muted-foreground">
        Leitura somente. As mensagens originais não são movidas nem apagadas. Respostas serão adicionadas em uma etapa posterior usando o Resend já configurado.
      </p>
    </section>
  );
}

type InboxMessage = {
  id: string;
  from_address: string;
  subject: string;
  body_text: string;
  received_at: string;
};

function MessageList({ messages }: { messages: InboxMessage[] }) {
  if (!messages.length) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma mensagem sincronizada nesta caixa.</p>;
  }
  return (
    <div className="max-h-[55vh] space-y-2 overflow-y-auto">
      {messages.map((message) => (
        <article key={message.id} className="rounded-lg border border-border/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium">{message.subject || "(Sem assunto)"}</p>
            <time className="text-xs text-muted-foreground" dateTime={message.received_at}>
              {new Date(message.received_at).toLocaleString("pt-BR")}
            </time>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{message.from_address}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body_text}</p>
        </article>
      ))}
    </div>
  );
}
