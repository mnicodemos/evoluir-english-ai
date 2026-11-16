/* eslint-disable prettier/prettier -- formatting is normalized in the follow-up cleanup */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, RefreshCw, Reply, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUiLang } from "@/lib/uiLang";
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
  const { lang } = useUiLang();
  const pt = lang === "pt";
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
      toast.error(pt ? "A Microsoft não concluiu a autorização. Tente novamente." : "Microsoft could not complete authorization. Please try again.");
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
        toast.success(pt ? `Conta Microsoft conectada: ${result.mailboxEmail}` : `Microsoft account connected: ${result.mailboxEmail}`);
        return queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : pt ? "Falha ao concluir conexão Microsoft." : "Failed to complete Microsoft connection.");
      })
      .finally(() => setBusy(null));
  }, [completeConnection, queryClient]);

  const connect = async () => {
    setBusy("connect");
    try {
      const result = await startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pt ? "Falha ao iniciar conexão Microsoft." : "Failed to start Microsoft connection.");
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const result = await syncInbox();
      toast.success(pt ? `${result.synced} mensagem(ns) sincronizada(s).` : `${result.synced} message(s) synchronized.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pt ? "Falha ao sincronizar mensagens." : "Failed to synchronize messages.");
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
        toast.error(error instanceof Error ? error.message : pt ? "Não foi possível marcar as mensagens como lidas." : "Could not mark messages as read.");
      });
  }, [markMessagesRead, messages, queryClient, selectedMailbox]);

  return (
    <section className="card-soft space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">{pt ? "Caixa de entrada" : "Inbox"}</h2>
            <p className="text-xs text-muted-foreground">
              {inbox.data?.connected
                ? pt ? `Microsoft conectado: ${inbox.data.mailboxEmail}` : `Microsoft connected: ${inbox.data.mailboxEmail}`
                : pt ? "Conecte a caixa Hotmail que recebe os encaminhamentos do ImprovMX." : "Connect the Hotmail inbox that receives forwarded messages from ImprovMX."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {inbox.data?.connected ? (
            <>
              <Button size="sm" variant="outline" onClick={connect} disabled={busy !== null}>
                {busy === "connect" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {pt ? "Reconectar Hotmail" : "Reconnect Hotmail"}
              </Button>
              <Button size="sm" variant="outline" onClick={sync} disabled={busy !== null}>
                {busy === "sync" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Sincronizar
              </Button>
            </>
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
          <Loader2 className="size-4 animate-spin" /> {pt ? "Carregando caixa de entrada…" : "Loading inbox…"}
        </div>
      ) : inbox.isError ? (
        <p className="py-4 text-sm text-destructive">
          {pt ? "Não foi possível carregar a caixa de entrada. Verifique as políticas da migração Admin Email RLS." : "Could not load the inbox. Check the Admin Email RLS migration policies."}
        </p>
      ) : !inbox.data?.connected ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {pt ? "A conexão ainda não foi realizada. Ao conectar, a Microsoft solicitará autorização de leitura da caixa." : "The inbox is not connected yet. Microsoft will request permission to read the mailbox when you connect."}
        </p>
      ) : (
        <Tabs value={selectedMailbox} onValueChange={(value) => setSelectedMailbox(value as "contact" | "support")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">{pt ? `Contato (${contact.length})` : `Contact (${contact.length})`}</TabsTrigger>
            <TabsTrigger value="support">{pt ? `Suporte (${support.length})` : `Support (${support.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="contact" className="mt-3 space-y-2"><MessageList messages={contact} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={removeMessage} pt={pt} /></TabsContent>
          <TabsContent value="support" className="mt-3 space-y-2"><MessageList messages={support} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={removeMessage} pt={pt} /></TabsContent>
        </Tabs>
      )}
      <p className="text-xs text-muted-foreground">
        {pt ? "As mensagens excluídas são movidas para Itens Excluídos do Hotmail e podem ser recuperadas por lá. As respostas são enviadas pelo Resend e registradas no histórico." : "Deleted messages are moved to Hotmail Deleted Items and can be recovered there. Replies are sent through Resend and recorded in the history."}
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
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{pt ? "Nenhuma mensagem sincronizada nesta caixa." : "No messages have been synchronized in this inbox."}</p>;
  }
  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto">
      {messages.map((message) => (
        <ReplyMessage key={message.id} message={message} sendReply={sendReply} loadReplyHistory={loadReplyHistory} deleteMessage={deleteMessage} pt={pt} />
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
    if (deleting || !window.confirm(pt ? "Mover esta mensagem para Itens Excluídos do Hotmail? Ela poderá ser recuperada por lá." : "Move this message to Hotmail Deleted Items? It can be recovered there.")) return;
    setDeleting(true);
    try {
      await deleteMessage({ data: { messageId: message.id } });
      toast.success(pt ? "Mensagem movida para Itens Excluídos do Hotmail." : "Message moved to Hotmail Deleted Items.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-unread-count"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pt ? "Não foi possível excluir a mensagem." : "Could not delete the message.");
    } finally {
      setDeleting(false);
    }
  };
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await sendReply({ data: { requestId: crypto.randomUUID(), messageId: message.id, body: body.trim() } });
      toast.success(pt ? "Resposta enviada pelo Resend." : "Reply sent through Resend.");
      setBody("");
      await history.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pt ? "Não foi possível enviar a resposta." : "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">{message.subject || pt ? "(Sem assunto)" : "(No subject)"}</p>
        <time className="text-xs text-muted-foreground" dateTime={message.received_at}>{new Date(message.received_at).toLocaleString(pt ? "pt-BR" : "en-US")}</time>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{message.from_address}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body_text}</p>
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
            <Reply className="mr-2 size-4" /> {open ? (pt ? "Fechar resposta" : "Close reply") : (pt ? "Responder" : "Reply")}
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
                  <span className="font-medium">{pt ? `Resposta ${reply.status === "sent" ? "enviada" : reply.status}` : `Reply ${reply.status === "sent" ? "sent" : reply.status}`}</span>
                  <span className="text-xs text-muted-foreground">{reply.sent_at ? new Date(reply.sent_at).toLocaleString(pt ? "pt-BR" : "en-US") : ""}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{reply.body_text}</p>
              </div>
            ))}
            <textarea className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} placeholder={pt ? "Escreva sua resposta…" : "Write your reply…"} />
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
