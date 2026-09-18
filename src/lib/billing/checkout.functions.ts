import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_INTERVALS, resolvePriceId } from "./stripeMapping";

/**
 * Strict input: the client may only name an allowed plan interval. Any attempt
 * to send a price, amount, currency, plan or premium flag is rejected.
 */
export const checkoutInputSchema = z
  .object({ interval: z.enum(BILLING_INTERVALS) })
  .strict();

export function parseCheckoutInput(input: unknown) {
  return checkoutInputSchema.parse(input);
}

function resolveOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin?.startsWith("http")) return origin;
  const referer = getRequestHeader("referer");
  if (referer?.startsWith("http")) return new URL(referer).origin;
  throw new Error("Could not determine the application origin for checkout.");
}

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseCheckoutInput)
  .handler(async ({ data, context }) => {
    const { getStripe } = await import("./stripe.server");
    const { getLinkedCustomerId, linkCustomer } = await import("./stripeSync.server");

    const priceId = resolvePriceId(data.interval, process.env as Record<string, string | undefined>);
    const stripe = getStripe();
    const origin = resolveOrigin();

    let customerId = await getLinkedCustomerId(context.userId);
    if (!customerId) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("email, name")
        .eq("id", context.userId)
        .maybeSingle();

      const customer = await stripe.customers.create({
        metadata: { user_id: context.userId },
        ...(profile?.email ? { email: profile.email } : {}),
        ...(profile?.name ? { name: profile.name } : {}),
      });
      customerId = customer.id;
      await linkCustomer(context.userId, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: context.userId,
      metadata: { user_id: context.userId, interval: data.interval },
      subscription_data: { metadata: { user_id: context.userId, interval: data.interval } },
      success_url: `${origin}/billing-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url };
  });
