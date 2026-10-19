import { createFileRoute } from "@tanstack/react-router";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getWhatsAppConfig } = await import("@/lib/whatsapp.server");
        let config;
        try {
          config = getWhatsAppConfig();
        } catch {
          return new Response("WhatsApp integration is not configured", { status: 503 });
        }

        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token === config.verifyToken && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        return new Response("Webhook verification failed", { status: 403 });
      },

      POST: async ({ request }) => {
        const {
          getWhatsAppConfig,
          hashWhatsAppLinkCode,
          normalizeWhatsAppPhone,
          parseWhatsAppInboundMessages,
          sendWhatsAppText,
          verifyWhatsAppSignature,
        } = await import("@/lib/whatsapp.server");
        let config;
        try {
          config = getWhatsAppConfig();
        } catch {
          return Response.json(
            { error: "WhatsApp integration is not configured." },
            { status: 503 },
          );
        }

        const rawBody = await request.text();
        if (
          !verifyWhatsAppSignature(
            rawBody,
            request.headers.get("x-hub-signature-256"),
            config.appSecret,
          )
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = parseWhatsAppInboundMessages(payload);
        if (!messages.length) {
          return Response.json({ received: true }, { headers: JSON_HEADERS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // These tables are service-role-only; generated Supabase types are unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are not yet in generated Supabase types
        const db = supabaseAdmin as any;

        for (const message of messages) {
          // Claim the provider message ID first; Meta retries cannot repeat actions.
          const { data: claimed, error: claimError } = await db
            .from("whatsapp_message_events")
            .insert({
              provider_message_id: message.id,
              phone_number: normalizeWhatsAppPhone(message.from),
              status: "received",
            })
            .select("provider_message_id")
            .maybeSingle();

          if (claimError || !claimed) continue;

          try {
            const phone = normalizeWhatsAppPhone(message.from);
            if (!phone || message.type !== "text" || !message.text?.body) {
              await db
                .from("whatsapp_message_events")
                .update({ status: "ignored", processed_at: new Date().toISOString() })
                .eq("provider_message_id", message.id);
              continue;
            }

            const connectMatch = message.text.body
              .trim()
              .match(/^(?:CONECTAR|CONNECT)\s+(\d{6})$/i);
            if (connectMatch) {
              const { data: linkCode } = await db
                .from("whatsapp_link_codes")
                .select("id, user_id")
                .eq("code_hash", hashWhatsAppLinkCode(connectMatch[1] ?? ""))
                .is("used_at", null)
                .gt("expires_at", new Date().toISOString())
                .maybeSingle();

              if (!linkCode) {
                await sendWhatsAppText(
                  config,
                  phone,
                  "Esse código é inválido ou expirou. Gere um novo código na sua conta Evoluir+.",
                );
              } else {
                // Consume the code conditionally so it cannot be reused.
                const { data: consumed } = await db
                  .from("whatsapp_link_codes")
                  .update({ used_at: new Date().toISOString() })
                  .eq("id", linkCode.id)
                  .is("used_at", null)
                  .gt("expires_at", new Date().toISOString())
                  .select("id")
                  .maybeSingle();

                if (!consumed) {
                  await sendWhatsAppText(
                    config,
                    phone,
                    "Esse código já foi utilizado. Gere um novo código na sua conta Evoluir+.",
                  );
                } else {
                  const { error: connectError } = await db.from("whatsapp_connections").upsert(
                    {
                      user_id: linkCode.user_id,
                      phone_number: phone,
                      connected_at: new Date().toISOString(),
                      revoked_at: null,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id" },
                  );
                  if (connectError) {
                    await sendWhatsAppText(
                      config,
                      phone,
                      "Não foi possível conectar esse número. Verifique se ele já está vinculado a outra conta e tente novamente.",
                    );
                  } else {
                    await sendWhatsAppText(
                      config,
                      phone,
                      "WhatsApp conectado ao Evoluir+ English AI! A conexão está confirmada. A prática com a EVO será habilitada na próxima etapa de ativação.",
                    );
                  }
                }
              }
            } else {
              const { data: connection } = await db
                .from("whatsapp_connections")
                .select("user_id")
                .eq("phone_number", phone)
                .is("revoked_at", null)
                .maybeSingle();

              const reply = connection
                ? "Sua conta Evoluir+ está conectada. A prática de inglês por aqui ainda não está ativada. Continue usando a AI Teacher no aplicativo enquanto finalizamos essa etapa."
                : "Olá! Para conectar seu WhatsApp ao Evoluir+ English AI, entre na sua conta, gere um código de conexão e envie CONECTAR seguido do código para este número.";
              await sendWhatsAppText(config, phone, reply);
            }

            await db
              .from("whatsapp_message_events")
              .update({ status: "processed", processed_at: new Date().toISOString() })
              .eq("provider_message_id", message.id);
          } catch (error) {
            // Log only the provider event ID and generic error; never log message contents or credentials.
            console.error(
              "[whatsapp] message processing failed",
              message.id,
              error instanceof Error ? error.message : "unknown",
            );
            await db
              .from("whatsapp_message_events")
              .update({ status: "failed", processed_at: new Date().toISOString() })
              .eq("provider_message_id", message.id);
          }
        }

        return Response.json({ received: true }, { headers: JSON_HEADERS });
      },
    },
  },
});
