import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type Stripe from "stripe";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { subscriptionGrantsAccess } from "./contracts";
import { BILLING_INTERVALS, resolvePriceId } from "./stripeMapping";
import { BLACK_FRIDAY, checkoutOffer } from "./blackFriday";

/**
 * Strict input: the client may only name an allowed plan interval. Any attempt
 * to send a price, amount, currency, plan or premium flag is rejected.
 */
export const checkoutInputSchema = z.object({ interval: z.enum(BILLING_INTERVALS) }).strict();

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

/** Shown when the account already has a subscription that grants Premium. */
export const ALREADY_SUBSCRIBED_MESSAGE =
  "Your Premium is already active. Manage it in My subscription.";

/** Stripe's error type, code and message (never the key), for server_errors. */
export function describeCheckoutError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const detail = error as Error & { type?: string; code?: string; statusCode?: number };
  return [detail.type, detail.code, detail.statusCode, error.message]
    .filter((part) => part !== undefined && part !== "")
    .join(" · ")
    .replace(/(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, "$1_$2_***");
}

/** Stripe's answer for a customer id the account does not have. */
export function isMissingCustomer(error: unknown): boolean {
  const detail = error as { code?: string; param?: string } | null;
  return detail?.code === "resource_missing" && detail.param === "customer";
}

/**
 * The Black Friday coupon, created in Stripe the first time it is needed:
 * 15% for 12 months, so it covers the yearly plan's first paid invoice even
 * after a trial (a "once" coupon could be spent on the trial's R$ 0 invoice)
 * and never its renewal.
 */
async function ensureBlackFridayCoupon(stripe: Stripe): Promise<void> {
  try {
    await stripe.coupons.retrieve(BLACK_FRIDAY.couponId);
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "resource_missing") throw error;
    await stripe.coupons.create({
      id: BLACK_FRIDAY.couponId,
      name: "Black Friday",
      percent_off: BLACK_FRIDAY.yearlyPercentOff,
      duration: "repeating",
      duration_in_months: 12,
      redeem_by: Math.floor(Date.parse(BLACK_FRIDAY.endsAt) / 1000),
    });
  }
}

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseCheckoutInput)
  .handler(async ({ data, context }) => {
    try {
      const { getStripe } = await import("./stripe.server");
      const { getLinkedCustomerId, linkCustomer } = await import("./stripeSync.server");

      const priceId = resolvePriceId(
        data.interval,
        process.env as Record<string, string | undefined>,
      );
      const stripe = getStripe();
      const origin = resolveOrigin();

      const createCustomer = async () => {
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
        await linkCustomer(context.userId, customer.id);
        return customer.id;
      };

      let customerId = await getLinkedCustomerId(context.userId);
      if (!customerId) customerId = await createCustomer();

      // 7 days free on the account's first subscription (trial.ts): Stripe takes
      // the card now and charges on day 8 unless the student cancels before.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: past } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, current_period_end")
        .eq("user_id", context.userId);
      // Never a second subscription while one still grants access (audit,
      // 2026-10-24: coming back to /premium before the webhook updated the
      // plan, or a second tap, could open another checkout and charge twice).
      if (
        (past ?? []).some((row) =>
          subscriptionGrantsAccess({
            status: row.status as never,
            current_period_end: row.current_period_end,
          }),
        )
      ) {
        throw new Error(ALREADY_SUBSCRIBED_MESSAGE);
      }
      // The first subscription's free trial (trial.ts), and during Black
      // Friday 15 days on the monthly plan and 15% off the yearly's first year.
      const offer = checkoutOffer(data.interval, past ?? [{}]);
      if (offer.couponId) await ensureBlackFridayCoupon(stripe);

      const openSession = (customer: string) =>
        stripe.checkout.sessions.create({
          mode: "subscription",
          customer,
          line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: context.userId,
          metadata: { user_id: context.userId, interval: data.interval },
          payment_method_collection: "always",
          ...(offer.couponId ? { discounts: [{ coupon: offer.couponId }] } : {}),
          subscription_data: {
            metadata: { user_id: context.userId, interval: data.interval },
            ...(offer.trialDays
              ? {
                  trial_period_days: offer.trialDays,
                  trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
                }
              : {}),
          },
          success_url: `${origin}/billing-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/premium`,
        });

      let session;
      try {
        session = await openSession(customerId);
      } catch (error) {
        // A saved customer the account does not have (user report,
        // 2026-10-23: one created in the Sandbox, then live keys): link a new
        // one and open the checkout with it.
        if (!isMissingCustomer(error)) throw error;
        console.error("Stripe checkout: saved customer not found; creating a new one");
        session = await openSession(await createCustomer());
      }

      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return { url: session.url };
    } catch (error) {
      // The student sees a generic message; the reason goes to server_errors
      // (user report, 2026-10-23: a live checkout failed with nothing logged).
      if (!(error instanceof Error && error.message === ALREADY_SUBSCRIBED_MESSAGE)) {
        console.error(`Stripe checkout failed: ${describeCheckoutError(error)}`);
      }
      throw error;
    }
  });
