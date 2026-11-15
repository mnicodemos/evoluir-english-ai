import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/email/microsoft/callback" as never)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const providerError = url.searchParams.get("error");
        const redirect = new URL("/admin", request.url);
        if (providerError || !state || !code) {
          redirect.searchParams.set("emailConnection", "failed");
          return Response.redirect(redirect, 303);
        }

        try {
          const {
            decryptMicrosoftToken,
            encryptMicrosoftToken,
            exchangeMicrosoftCode,
            getMicrosoftRedirectUri,
            graphGetProfile,
            verifyOAuthState,
          } = await import("@/lib/admin-email.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- service-only tables are intentionally absent from client types
          const db = supabaseAdmin as any;
          const verified = verifyOAuthState(state);
          const { data: handshake, error: handshakeError } = await db
            .from("admin_email_oauth_states")
            .select("nonce,user_id,verifier_encrypted,expires_at")
            .eq("nonce", verified.nonce)
            .eq("user_id", verified.userId)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();
          if (handshakeError || !handshake) throw new Error("OAuth handshake expired");

          const { data: admin, error: adminError } = await supabaseAdmin.rpc("has_role", {
            _user_id: verified.userId,
            _role: "admin",
          });
          if (adminError || admin !== true) throw new Error("Administrator authorization failed");

          // Consume the one-time state before exchanging the authorization code.
          const { error: consumeError } = await db
            .from("admin_email_oauth_states")
            .delete()
            .eq("nonce", verified.nonce)
            .eq("user_id", verified.userId);
          if (consumeError) throw new Error("Could not consume OAuth state");

          const tokens = await exchangeMicrosoftCode(
            code,
            decryptMicrosoftToken(handshake.verifier_encrypted),
            getMicrosoftRedirectUri(request.url),
          );
          const profile = await graphGetProfile(tokens.access_token);
          const mailboxEmail = (profile.mail || profile.userPrincipalName || "")
            .trim()
            .toLowerCase();
          if (!mailboxEmail || !mailboxEmail.includes("@")) {
            throw new Error("Microsoft mailbox address is unavailable");
          }

          const { data: existing, error: lookupError } = await db
            .from("admin_email_connections")
            .select("id")
            .is("revoked_at", null)
            .maybeSingle();
          if (lookupError) throw lookupError;
          const connection = {
            provider: "microsoft",
            mailbox_email: mailboxEmail,
            connected_by: verified.userId,
            refresh_token_encrypted: encryptMicrosoftToken(tokens.refresh_token),
            token_expires_at: new Date(
              Date.now() + (tokens.expires_in ?? 3600) * 1000,
            ).toISOString(),
            scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
            updated_at: new Date().toISOString(),
            revoked_at: null,
          };
          const write = existing
            ? await db.from("admin_email_connections").update(connection).eq("id", existing.id)
            : await db.from("admin_email_connections").insert(connection);
          if (write.error) throw write.error;

          redirect.searchParams.set("emailConnection", "connected");
          return Response.redirect(redirect, 303);
        } catch (error) {
          console.error(
            "[admin-email] Microsoft callback failed",
            error instanceof Error ? error.message : "unknown",
          );
          redirect.searchParams.set("emailConnection", "failed");
          return Response.redirect(redirect, 303);
        }
      },
    },
  },
});
