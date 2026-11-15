/* eslint-disable prettier/prettier -- formatting is normalized in the follow-up cleanup */
import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
}

export const startMicrosoftEmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const {
      createOAuthState,
      createPkcePair,
      encryptMicrosoftToken,
      getMicrosoftRedirectUri,
      microsoftAuthorizationUrl,
    } = await import("@/lib/admin-email.server");
    const nonce = randomBytes(24).toString("base64url");
    const { verifier, challenge } = createPkcePair();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    // OAuth handshake is stored through the authenticated Lovable Cloud session (RLS).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by the accompanying migration
    const db = context.supabase as any;
    const { error } = await db.from("admin_email_oauth_states").insert({
      nonce,
      user_id: context.userId,
      verifier_encrypted: encryptMicrosoftToken(verifier),
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[admin-email] Could not persist OAuth state", error.message);
      throw new Error("Não foi possível iniciar a autorização Microsoft. Verifique a migração e as políticas de acesso.");
    }
    const request = getRequest();
    if (!request?.url) throw new Error("Request URL unavailable");
    const state = createOAuthState(context.userId, nonce);
    return {
      authorizationUrl: microsoftAuthorizationUrl(
        getMicrosoftRedirectUri(request.url),
        state,
        challenge,
      ),
    };
  });

export const completeMicrosoftEmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { decryptMicrosoftToken, encryptMicrosoftToken, exchangeMicrosoftCode,
      getMicrosoftRedirectUri, graphGetProfile, verifyOAuthState } =
      await import("@/lib/admin-email.server");
    const verified = verifyOAuthState(data.state);
    if (verified.userId !== context.userId) throw new Error("A autorização Microsoft pertence a outra sessão.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by the accompanying migration
    const db = context.supabase as any;
    const { data: handshake, error: handshakeError } = await db
      .from("admin_email_oauth_states")
      .select("nonce,user_id,verifier_encrypted,expires_at")
      .eq("nonce", verified.nonce)
      .eq("user_id", context.userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (handshakeError || !handshake) throw new Error("A autorização expirou. Tente conectar novamente.");
    const { error: consumeError } = await db.from("admin_email_oauth_states")
      .delete().eq("nonce", verified.nonce).eq("user_id", context.userId);
    if (consumeError) throw new Error("Não foi possível validar a autorização. Tente novamente.");
    const request = getRequest();
    if (!request?.url) throw new Error("Request URL unavailable");
    const tokens = await exchangeMicrosoftCode(
      data.code,
      decryptMicrosoftToken(handshake.verifier_encrypted),
      getMicrosoftRedirectUri(request.url),
    );
    const profile = await graphGetProfile(tokens.access_token);
    const mailboxEmail = (profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
    if (!mailboxEmail || !mailboxEmail.includes("@")) {
      throw new Error("Não foi possível identificar a caixa Microsoft.");
    }
    const { data: existing, error: lookupError } = await db.from("admin_email_connections")
      .select("id").is("revoked_at", null).maybeSingle();
    if (lookupError) throw lookupError;
    const connection = {
      provider: "microsoft",
      mailbox_email: mailboxEmail,
      connected_by: context.userId,
      refresh_token_encrypted: encryptMicrosoftToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    };
    const write = existing
      ? await db.from("admin_email_connections").update(connection).eq("id", existing.id)
      : await db.from("admin_email_connections").insert(connection);
    if (write.error) throw write.error;
    return { mailboxEmail };
  });

export const getAdminEmailInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by the accompanying migration
    const db = context.supabase as any;
    const { data: connection, error: connectionError } = await db
      .from("admin_email_connections")
      .select("mailbox_email,token_expires_at,updated_at")
      .is("revoked_at", null)
      .maybeSingle();
    if (connectionError) throw connectionError;
    const { data: messages, error } = await db
      .from("admin_email_messages")
      .select("id,mailbox,from_address,to_addresses,subject,body_text,received_at,is_read,provider_conversation_id")
      .neq("mailbox", "unknown").order("received_at", { ascending: false }).limit(100);
    if (error) throw error;
    return {
      connected: Boolean(connection),
      mailboxEmail: connection?.mailbox_email ?? null,
      updatedAt: connection?.updated_at ?? null,
      messages: messages ?? [],
    };
  });

export const syncAdminEmailInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is introduced by the accompanying migration
    const db = context.supabase as any;
    const {
      decryptMicrosoftToken,
      encryptMicrosoftToken,
      refreshMicrosoftToken,
      syncGraphInbox,
    } = await import("@/lib/admin-email.server");

    const { data: connection, error: connectionError } = await db
      .from("admin_email_connections")
      .select("id,refresh_token_encrypted,delta_link")
      .is("revoked_at", null)
      .maybeSingle();
    if (connectionError) {
      console.error("[admin-email] Failed to load Microsoft connection", {
        code: connectionError.code,
      });
      throw new Error("Não foi possível carregar a conexão Microsoft do banco de dados.");
    }
    if (!connection) throw new Error("A caixa Microsoft não está conectada.");

    let refreshed: Awaited<ReturnType<typeof refreshMicrosoftToken>>;
    try {
      const refreshToken = decryptMicrosoftToken(connection.refresh_token_encrypted);
      refreshed = await refreshMicrosoftToken(refreshToken);
    } catch (error) {
      console.error("[admin-email] Microsoft token refresh failed", {
        message: error instanceof Error ? error.message.slice(0, 700) : "Unknown error",
      });
      throw new Error(
        error instanceof Error
          ? `Falha ao renovar a autorização Microsoft: ${error.message}`
          : "Falha ao renovar a autorização Microsoft.",
      );
    }

    let result: Awaited<ReturnType<typeof syncGraphInbox>>;
    try {
      result = await syncGraphInbox(refreshed.access_token, connection.delta_link);
    } catch (error) {
      console.error("[admin-email] Microsoft Graph inbox sync failed", {
        message: error instanceof Error ? error.message.slice(0, 700) : "Unknown error",
      });
      throw new Error(
        error instanceof Error
          ? `Falha ao ler a caixa no Microsoft Graph: ${error.message}`
          : "Falha ao ler a caixa no Microsoft Graph.",
      );
    }

    if (result.messages.length) {
      // Microsoft Graph delta pages can contain the same message more than once.
      // Postgres rejects an ON CONFLICT batch that targets one row repeatedly.
      const uniqueMessages = [
        ...new Map(result.messages.map((message) => [message.provider_message_id, message])).values(),
      ];
      const { error: upsertError } = await db
        .from("admin_email_messages")
        .upsert(uniqueMessages, {
          onConflict: "provider_message_id",
          ignoreDuplicates: false,
        });
      if (upsertError) {
        const databaseMessage =
          typeof upsertError.message === "string"
            ? upsertError.message.replace(/[\\r\\n]+/g, " ").slice(0, 500)
            : "Database rejected the message batch";
        console.error("[admin-email] Failed to persist synchronized messages", {
          code: upsertError.code,
          message: databaseMessage,
        });
        throw new Error(
          `Falha ao salvar mensagens no banco (${upsertError.code ?? "sem código"}): ${databaseMessage}`,
        );
      }
    }

    const { error: updateError } = await db
      .from("admin_email_connections")
      .update({
        refresh_token_encrypted: encryptMicrosoftToken(refreshed.refresh_token),
        token_expires_at: new Date(
          Date.now() + (refreshed.expires_in ?? 3600) * 1000,
        ).toISOString(),
        delta_link: result.deltaLink ?? connection.delta_link,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    if (updateError) {
      console.error("[admin-email] Failed to update Microsoft sync cursor", {
        code: updateError.code,
      });
      throw new Error("As mensagens foram lidas, mas não foi possível salvar o estado da sincronização.");
    }

    return { synced: result.messages.length };
  });

 
export const sendAdminEmailReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input as { requestId: string; messageId: string; body: string };
    if (
      !value ||
      !/^[0-9a-f-]{36}$/i.test(value.requestId) ||
      !/^[0-9a-f-]{36}$/i.test(value.messageId) ||
      typeof value.body !== "string" ||
      value.body.trim().length < 1 ||
      value.body.length > 10000
    ) {
      throw new Error("Resposta inválida. Verifique o texto e tente novamente.");
    }
    return { requestId: value.requestId, messageId: value.messageId, body: value.body.trim() };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin email tables are managed by Lovable Cloud migrations
    const db = context.supabase as any;
    const { data: parent, error: parentError } = await db
      .from("admin_email_messages")
      .select("id,mailbox,from_address,subject,internet_message_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (parentError || !parent) throw new Error("Mensagem original não encontrada.");
    if (!["contact", "support"].includes(parent.mailbox)) {
      throw new Error("Esta mensagem não pertence às caixas autorizadas.");
    }
    const recipient = String(parent.from_address || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error("O remetente original não possui um endereço de resposta válido.");
    }
    const expectedSender =
      parent.mailbox === "contact"
        ? "contato@evoluirmaisenglishai.com"
        : "suporte@evoluirmaisenglishai.com";
    const sender = process.env[
      parent.mailbox === "contact" ? "RESEND_CONTACT_FROM_EMAIL" : "RESEND_SUPPORT_FROM_EMAIL"
    ]?.trim();
    if (!sender) {
      throw new Error(
        parent.mailbox === "contact"
          ? "Configure RESEND_CONTACT_FROM_EMAIL no Lovable Cloud."
          : "Configure RESEND_SUPPORT_FROM_EMAIL no Lovable Cloud.",
      );
    }
    const senderAddress = sender.match(/<([^>]+)>/)?.[1]?.trim().toLowerCase() ?? sender.toLowerCase();
    if (senderAddress !== expectedSender) {
      throw new Error(`O remetente Resend precisa ser ${expectedSender} e estar verificado.`);
    }
    const subject = /^re:/i.test(parent.subject || "")
      ? parent.subject
      : `Re: ${parent.subject || "(Sem assunto)"}`;
    const { data: existing, error: existingError } = await db
      .from("admin_email_replies")
      .select("id,status,resend_email_id")
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (existingError) throw new Error("Não foi possível verificar o histórico de respostas.");
    if (existing?.status === "sent" && existing.resend_email_id) {
      return { sent: true as const, resendId: existing.resend_email_id };
    }
    if (!existing) {
      const { error: insertError } = await db.from("admin_email_replies").insert({
        request_id: data.requestId,
        parent_message_id: parent.id,
        recipient_email: recipient,
        from_email: sender,
        subject,
        body_text: data.body,
        status: "pending",
        sent_by: context.userId,
      });
      if (insertError) throw new Error("Não foi possível registrar a resposta antes do envio.");
    }
    try {
      const { sendAdminEmailReply: send } = await import("@/lib/admin-email.server");
      const result = await send({
        requestId: data.requestId,
        to: recipient,
        from: sender,
        subject,
        body: data.body,
        inReplyTo: parent.internet_message_id,
      });
      const { error: updateError } = await db
        .from("admin_email_replies")
        .update({
          status: "sent",
          resend_email_id: result.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("request_id", data.requestId);
      if (updateError) throw new Error("E-mail enviado, mas não foi possível atualizar o histórico.");
      return { sent: true as const, resendId: result.id };
    } catch (error) {
      await db
        .from("admin_email_replies")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 500) : "Unknown send error",
        })
        .eq("request_id", data.requestId);
      throw error;
    }
  });

export const getAdminEmailReplyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input as { messageId: string };
    if (!value || !/^[0-9a-f-]{36}$/i.test(value.messageId)) {
      throw new Error("Mensagem inválida.");
    }
    return { messageId: value.messageId };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin email tables are managed by Lovable Cloud migrations
    const db = context.supabase as any;
    const { data: replies, error } = await db
      .from("admin_email_replies")
      .select("id,recipient_email,from_email,subject,body_text,status,sent_at,created_at")
      .eq("parent_message_id", data.messageId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar o histórico de respostas.");
    return replies ?? [];
  });


/** Mark only messages actually shown in the selected admin mailbox as read. */
export const markAdminEmailMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageIds: string[] }) => {
    if (
      !input ||
      !Array.isArray(input.messageIds) ||
      input.messageIds.length > 100 ||
      input.messageIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
    ) {
      throw new Error("Lista de mensagens inválida.");
    }
    return { messageIds: [...new Set(input.messageIds)] };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.messageIds.length) return { updated: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin email tables are managed by Lovable Cloud migrations
    const db = context.supabase as any;
    const { data: updated, error } = await db
      .from("admin_email_messages")
      .update({ is_read: true })
      .in("id", data.messageIds)
      .in("mailbox", ["contact", "support"])
      .eq("is_read", false)
      .select("id");
    if (error) throw new Error("Não foi possível atualizar o estado das mensagens.");
    return { updated: updated?.length ?? 0 };
  });

/** Lightweight unread count for the admin home header; no message bodies leave the server. */
export const getAdminEmailUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mailbox: "contact" | "support" }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin email tables are managed by Lovable Cloud migrations
    const db = context.supabase as any;
    const { count, error } = await db
      .from("admin_email_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("mailbox", data.mailbox);
    if (error) throw new Error("Não foi possível consultar as notificações de e-mail.");
    return { unread: count ?? 0 };
  });
