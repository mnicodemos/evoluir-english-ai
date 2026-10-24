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

        // Without Stripe configuration no signature can be verified, so the
        // request is rejected the same way as an invalid one (never a 500).
        let stripe: Stripe;
        let webhookSecret: string;
        try {
          stripe = getStripe();
          webhookSecret = getWebhookSecret();
        } catch (error) {
          console.error("[stripe] webhook not configured", (error as Error).message);
          return new Response("Invalid signature", { status: 400 });
        }

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            rawBody,
            signature,
            webhookSecret,
            undefined,
            (
              stripe as unknown as { createSubtleCryptoProvider?: () => unknown }
            ).createSubtleCryptoProvider?.() as never,
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
          // A failed event answered 500, so Stripe sends it again: take it back
          // instead of acknowledging it as a duplicate, which left a paid
          // subscription without its access (audit, 2026-10-24). A run stuck
          // in "processing" for 5 minutes (the host stopped) is taken back too.
          const stuckBefore = new Date(Date.now() - 5 * 60_000).toISOString();
          const { data: retried } = await supabaseAdmin
            .from("stripe_webhook_events")
            .update({ status: "processing", error_message: null })
            .eq("event_id", event.id)
            .or(`status.eq.failed,and(status.eq.processing,received_at.lt."${stuckBefore}")`)
            .select("event_id")
            .maybeSingle();
          if (retried) {
            return processClaimed(stripe, event, startedAt, supabaseAdmin);
          }
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return processClaimed(stripe, event, startedAt, supabaseAdmin);
      },
    },
  },
});

/** Processes an event this request claimed and records how it went. */
async function processClaimed(
  stripe: Stripe,
  event: Stripe.Event,
  startedAt: number,
  supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"],
): Promise<Response> {
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
}

async function handleEvent(stripe: Stripe, event: Stripe.Event): Promise<boolean> {
  const { syncSubscription, resolveUserId, linkCustomer } =
    await import("@/lib/billing/stripeSync.server");

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
      // Read the subscription as it is now: events can arrive out of order,
      // and an older "updated" must never undo a newer state.
      const payload = event.data.object as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(payload.id).catch(() => payload);
      await syncSubscription(subscription as never);
      return true;
    }

    default:
      return false;
  }
}
