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
    const { decryptMicrosoftToken, encryptMicrosoftToken, refreshMicrosoftToken, syncGraphInbox } =
      await import("@/lib/admin-email.server");
    const { data: connection, error } = await db.from("admin_email_connections")
      .select("id,refresh_token_encrypted,delta_link").is("revoked_at", null).maybeSingle();
    if (error) throw error;
    if (!connection) throw new Error("Microsoft mailbox is not connected");
    const refreshed = await refreshMicrosoftToken(decryptMicrosoftToken(connection.refresh_token_encrypted));
    const result = await syncGraphInbox(refreshed.access_token, connection.delta_link);
    if (result.messages.length) {
      const { error: upsertError } = await db.from("admin_email_messages")
        .upsert(result.messages, { onConflict: "provider_message_id", ignoreDuplicates: false });
      if (upsertError) throw upsertError;
    }
    const { error: updateError } = await db.from("admin_email_connections").update({
      refresh_token_encrypted: encryptMicrosoftToken(refreshed.refresh_token),
      token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
      delta_link: result.deltaLink ?? connection.delta_link,
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);
    if (updateError) throw updateError;
    return { synced: result.messages.length };
  });
