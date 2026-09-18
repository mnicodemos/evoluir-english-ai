import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 7: open the official Stripe Customer Portal for the signed-in user.
 * The customer is resolved server-side from the user's own record — the client
 * never sends a customer id, and cancellation keeps flowing through Stripe ->
 * webhook -> subscriptions -> entitlements.
 */
export const createStripePortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string | null }> => {
    const [{ getStripe }, { getLinkedCustomerId }] = await Promise.all([
      import("./stripe.server"),
      import("./stripeSync.server"),
    ]);

    const customerId = await getLinkedCustomerId(context.userId);
    if (!customerId) return { url: null };

    const origin = new URL((await import("@tanstack/react-start/server")).getRequest().url).origin;

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/premium`,
    });

    return { url: session.url };
  });
