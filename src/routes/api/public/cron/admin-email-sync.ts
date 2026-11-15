import { createFileRoute } from "@tanstack/react-router";

import { keepAlive } from "@/lib/keepAlive.server";

/** Constant-time comparison for the database-held scheduler secret. */
async function matchesSecret(provided: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export const Route = createFileRoute("/api/public/cron/admin-email-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provided = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: keyRow } = await supabaseAdmin
          .from("push_cron_key")
          .select("key")
          .eq("id", 1)
          .maybeSingle();

        if (!provided || !keyRow?.key || !(await matchesSecret(provided, keyRow.key))) {
          return new Response("Unauthorized", { status: 401 });
        }

        return keepAlive(syncAdminEmailInbox(supabaseAdmin));
      },
    },
  },
});

async function syncAdminEmailInbox(supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin) {
  const { data: connection, error } = await supabaseAdmin
    .from("admin_email_connections")
    .select("id,refresh_token_encrypted,delta_link")
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error("Could not load the Microsoft email connection");
  if (!connection) return Response.json({ synced: 0, connected: false });

  const {
    decryptMicrosoftToken,
    encryptMicrosoftToken,
    refreshMicrosoftToken,
    syncGraphInbox,
  } = await import("@/lib/admin-email.server");

  const refreshed = await refreshMicrosoftToken(
    decryptMicrosoftToken(connection.refresh_token_encrypted),
  );
  const result = await syncGraphInbox(refreshed.access_token, connection.delta_link);

  if (result.messages.length) {
    const uniqueMessages = [
      ...new Map(result.messages.map((message) => [message.provider_message_id, message])).values(),
    ];
    const { error: upsertError } = await db
      .from("admin_email_messages")
      .upsert(uniqueMessages, {
        onConflict: "provider_message_id",
        ignoreDuplicates: false,
      });
    if (upsertError) throw new Error("Could not save synchronized admin email messages");
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

  if (updateError) throw new Error("Could not update the Microsoft email sync cursor");

  return Response.json({ synced: result.messages.length, connected: true });
}
