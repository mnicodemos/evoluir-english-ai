import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

/**
 * Stripe webhook. The signature is the only source of authority: nothing is
 * read from the body before it is verified, and no client input is trusted.
 */
export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();

        const { getStripe, getWebhookSecret } = await import("@/lib/billing/stripe.server");
        const stripe = getStripe();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            rawBody,
            signature,
            getWebhookSecret(),
            undefined,
            (stripe as unknown as { createSubtleCryptoProvider?: () => unknown })
              .createSubtleCryptoProvider?.() as never,
          );
        } catch (error) {
          console.error("[stripe] invalid webhook signature", (error as Error).message);
          return new Response("Invalid signature", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: the first insert wins, replays are acknowledged as no-ops.
        const { data: claimed } = await supabaseAdmin
          .from("stripe_webhook_events")
          .insert({ event_id: event.id, event_type: event.type, status: "processing" })
          .select("event_id")
          .maybeSingle();

        if (!claimed) {
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const handled = await handleEvent(stripe, event);
          await supabaseAdmin
            .from("stripe_webhook_events")
            .update({
              status: handled ? "processed" : "ignored",
              processed_at: new Date().toISOString(),
              duration_ms: Date.now() - startedAt,
            })
            .eq("event_id", event.id);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          console.error(`[stripe] failed to process ${event.type}`, (error as Error).message);
          await supabaseAdmin
            .from("stripe_webhook_events")
            .update({
              status: "failed",
              error_message: (error as Error).message.slice(0, 240),
              processed_at: new Date().toISOString(),
              duration_ms: Date.now() - startedAt,
            })
            .eq("event_id", event.id);
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});

async function handleEvent(stripe: Stripe, event: Stripe.Event): Promise<boolean> {
  const { syncSubscription, resolveUserId, linkCustomer } = await import(
    "@/lib/billing/stripeSync.server"
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return false;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const userId = await resolveUserId({
        metadataUserId: session.metadata?.["user_id"] ?? session.client_reference_id ?? null,
        customerId: customerId ?? null,
      });
      if (userId && customerId) await linkCustomer(userId, customerId);

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription as never, userId);
      return true;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | { id: string } | null } };
      };
      const raw =
        invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
      const subscriptionId = typeof raw === "string" ? raw : raw?.id;
      if (!subscriptionId) return false;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription as never);
      return true;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as never);
      return true;
    }

    default:
      return false;
  }
}
