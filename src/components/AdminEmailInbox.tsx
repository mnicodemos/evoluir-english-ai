/* eslint-disable prettier/prettier -- formatting is normalized in the follow-up cleanup */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, RefreshCw, Reply, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  completeMicrosoftEmailConnection,
  getAdminEmailInbox,
  startMicrosoftEmailConnection,
  syncAdminEmailInbox,
  sendAdminEmailReply,
  getAdminEmailReplyHistory,
  markAdminEmailMessagesRead,
  deleteAdminEmailMessage,
} from "@/lib/admin-email.functions";

export function AdminEmailInbox({ initialMailbox = "contact" }: { initialMailbox?: "contact" | "support" }) {
  const queryClient = useQueryClient();
  const loadInbox = useServerFn(getAdminEmailInbox);
  const startConnection = useServerFn(startMicrosoftEmailConnection);
  const completeConnection = useServerFn(completeMicrosoftEmailConnection);
  const syncInbox = useServerFn(syncAdminEmailInbox);
  const sendReply = useServerFn(sendAdminEmailReply);
  const loadReplyHistory = useServerFn(getAdminEmailReplyHistory);
  const markMessagesRead = useServerFn(markAdminEmailMessagesRead);
  const removeMessage = useServerFn(deleteAdminEmailMessage);
  const markingReadIds = useRef(new Set<string>());
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<"contact" | "support">(initialMailbox);

  useEffect(() => {
    setSelectedMailbox(initialMailbox);
  }, [initialMailbox]);
  const inbox = useQuery({
    queryKey: ["admin-email-inbox"],
    queryFn: () => loadInbox(),
    staleTime: 15_000,
    retry: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("emailConnection");
    const code = params.get("emailCode");
    const state = params.get("emailState");
    if (status === "failed") {
      toast.error("A Microsoft não concluiu a autorização. Tente novamente.");
    }
    if (!code || !state) {
      if (status) {
        params.delete("emailConnection");
        const clean = new URL(window.location.href);
        clean.search = params.toString();
        window.history.replaceState({}, "", clean);
      }
      return;
    }
    setBusy("connect");
    params.delete("emailCode");
    params.delete("emailState");
    const clean = new URL(window.location.href);
    clean.search = params.toString();
    window.history.replaceState({}, "", clean);
    void completeConnection({ data: { code, state } })
      .then((result) => {
        toast.success(`Conta Microsoft conectada: ${result.mailboxEmail}`);
        return queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao concluir conexão Microsoft.");
      })
      .finally(() => setBusy(null));
  }, [completeConnection, queryClient]);

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
  const contact = messages.filter((message: InboxMessage) => message.mailbox === "contact");
  const support = messages.filter((message: InboxMessage) => message.mailbox === "support");

  useEffect(() => {
    const visibleUnreadIds = messages
      .filter((message: InboxMessage) => message.mailbox === selectedMailbox && !message.is_read)
      .map((message: InboxMessage) => message.id)
      .filter((id: string) => !markingReadIds.current.has(id));
    if (!visibleUnreadIds.length) return;

    visibleUnreadIds.forEach((id: string) => markingReadIds.current.add(id));
    void markMessagesRead({ data: { messageIds: visibleUnreadIds } })
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] }),
          queryClient.invalidateQueries({ queryKey: ["admin-email-unread-count"] }),
        ]);
      })
      .catch((error) => {
        visibleUnreadIds.forEach((id: string) => markingReadIds.current.delete(id));
        toast.error(error instanceof Error ? error.message : "Não foi possível marcar as mensagens como lidas.");
      });
  }, [markMessagesRead, messages, queryClient, selectedMailbox]);

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
        <p className="py-4 text-sm text-destructive">
          Não foi possível carregar a caixa de entrada. Verifique as políticas da migração Admin Email RLS.
        </p>
      ) : !inbox.data?.connected ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          A conexão ainda não foi realizada. Ao conectar, a Microsoft solicitará autorização de leitura da caixa.
        </p>
      ) : (
        <Tabs value={selectedMailbox} onValueChange={(value) => setSelectedMailbox(value as "contact" | "support")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">Contato ({contact.length})</TabsTrigger>
            <TabsTrigger value="support">Suporte ({support.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="contact" className="mt-3 space-y-2"><MessageList messages={contact} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={removeMessage} /></TabsContent>
          <TabsContent value="support" className="mt-3 space-y-2"><MessageList messages={support} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={removeMessage} /></TabsContent>
        </Tabs>
      )}
      <p className="text-xs text-muted-foreground">
        As mensagens excluídas são movidas para Itens Excluídos do Hotmail e podem ser recuperadas por lá. As respostas são enviadas pelo Resend e registradas no histórico.
      </p>
    </section>
  );
}

type InboxMessage = {
  id: string;
  mailbox: "contact" | "support" | "unknown";
  from_address: string;
  subject: string;
  body_text: string;
  received_at: string;
  is_read: boolean;
};


type ReplySender = (args: { data: { requestId: string; messageId: string; body: string } }) => Promise<{ sent: true; resendId: string }>;
type MessageDeleter = (args: { data: { messageId: string } }) => Promise<{ deleted: true }>;
type ReplyHistoryLoader = (args: { data: { messageId: string } }) => Promise<Array<{
  id: string; body_text: string; status: string; sent_at: string | null;
}>>;

function MessageList({
  messages,
  sendReply,
  loadReplyHistory,
  deleteMessage,
}: {
  messages: InboxMessage[];
  sendReply: ReplySender;
  loadReplyHistory: ReplyHistoryLoader;
  deleteMessage: MessageDeleter;
}) {
  if (!messages.length) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma mensagem sincronizada nesta caixa.</p>;
  }
  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto">
      {messages.map((message) => (
        <ReplyMessage key={message.id} message={message} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={deleteMessage} />
      ))}
    </div>
  );
}

function ReplyMessage({
  message,
  sendReply,
  loadReplyHistory,
  deleteMessage,
}: {
  message: InboxMessage;
  sendReply: ReplySender;
  loadReplyHistory: ReplyHistoryLoader;
  deleteMessage: MessageDeleter;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["admin-email-replies", message.id],
    queryFn: () => loadReplyHistory({ data: { messageId: message.id } }),
    enabled: open,
    retry: false,
  });
  const remove = async () => {
    if (deleting || !window.confirm("Mover esta mensagem para Itens Excluídos do Hotmail? Ela poderá ser recuperada por lá.")) return;
    setDeleting(true);
    try {
      await deleteMessage({ data: { messageId: message.id } });
      toast.success("Mensagem movida para Itens Excluídos do Hotmail.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-unread-count"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a mensagem.");
    } finally {
      setDeleting(false);
    }
  };
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await sendReply({ data: { requestId: crypto.randomUUID(), messageId: message.id, body: body.trim() } });
      toast.success("Resposta enviada pelo Resend.");
      setBody("");
      await history.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a resposta.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">{message.subject || "(Sem assunto)"}</p>
        <time className="text-xs text-muted-foreground" dateTime={message.received_at}>{new Date(message.received_at).toLocaleString("pt-BR")}</time>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{message.from_address}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body_text}</p>
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
            <Reply className="mr-2 size-4" /> {open ? "Fechar resposta" : "Responder"}
          </Button>
          <Button size="sm" variant="destructive" onClick={remove} disabled={deleting}>
            {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
            Excluir
          </Button>
        </div>
        {open ? (
          <div className="mt-3 space-y-3">
            {history.data?.map((reply) => (
              <div key={reply.id} className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Resposta {reply.status === "sent" ? "enviada" : reply.status}</span>
                  <span className="text-xs text-muted-foreground">{reply.sent_at ? new Date(reply.sent_at).toLocaleString("pt-BR") : ""}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{reply.body_text}</p>
              </div>
            ))}
            <textarea className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} placeholder="Escreva sua resposta…" />
            <div className="flex justify-end">
              <Button size="sm" onClick={submit} disabled={!body.trim() || busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Enviar resposta
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
