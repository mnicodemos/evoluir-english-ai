import type Stripe from "stripe";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GATED_FEATURES, subscriptionGrantsAccess } from "./contracts";
import { mapStripeStatus, secondsToIso } from "./stripeMapping";

const PROVIDER = "stripe";

/** Resolve the internal user for a Stripe customer, without trusting email. */
export async function resolveUserId(input: {
  metadataUserId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (input.metadataUserId) return input.metadataUserId;
  if (!input.customerId) return null;

  const { data } = await supabaseAdmin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", input.customerId)
    .maybeSingle();
  if (data?.user_id) return data.user_id;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("provider", PROVIDER)
    .eq("provider_customer_id", input.customerId)
    .limit(1)
    .maybeSingle();
  return sub?.user_id ?? null;
}

export async function linkCustomer(userId: string, customerId: string): Promise<void> {
  await supabaseAdmin
    .from("stripe_customers")
    .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
}

export async function getLinkedCustomerId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}

type StripeSubscriptionLike = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

function periodFromSubscription(subscription: StripeSubscriptionLike) {
  const item = subscription.items?.data?.[0] as
    { current_period_start?: number | null; current_period_end?: number | null } | undefined;
  return {
    start: secondsToIso(subscription.current_period_start ?? item?.current_period_start ?? null),
    end: secondsToIso(subscription.current_period_end ?? item?.current_period_end ?? null),
  };
}

/**
 * Upsert the internal subscription from the Stripe object (the only authority)
 * and reconcile entitlements. Idempotent: re-running with the same Stripe state
 * produces the same rows.
 */
export async function syncSubscription(
  subscription: StripeSubscriptionLike,
  fallbackUserId?: string | null,
): Promise<{ userId: string | null; status: string }> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const userId =
    (await resolveUserId({
      metadataUserId: subscription.metadata?.["user_id"] ?? null,
      customerId: customerId ?? null,
    })) ??
    fallbackUserId ??
    null;

  const status = mapStripeStatus(subscription.status);
  if (!userId) return { userId: null, status };

  if (customerId) await linkCustomer(userId, customerId);

  const period = periodFromSubscription(subscription);
  const row = {
    user_id: userId,
    plan: "premium" as const,
    status,
    provider: PROVIDER,
    provider_customer_id: customerId ?? null,
    provider_subscription_id: subscription.id,
    started_at: secondsToIso(subscription.start_date),
    current_period_start: period.start,
    current_period_end: period.end,
    canceled_at: secondsToIso(subscription.canceled_at),
  };

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("provider", PROVIDER)
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  // A failed write throws, so the webhook answers 500 and Stripe sends the
  // event again (audit, 2026-10-24: errors were ignored and the event was
  // marked processed, leaving a paid student without access).
  let subscriptionId = existing?.id ?? null;
  if (subscriptionId) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update(row)
      .eq("id", subscriptionId);
    if (error) throw new Error(`subscription update failed: ${error.message}`);
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("subscriptions")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(`subscription insert failed: ${error.message}`);
    subscriptionId = inserted?.id ?? null;
  }

  const grantsAccess = subscriptionGrantsAccess({ status, current_period_end: period.end });
  await reconcileEntitlements({
    userId,
    subscriptionId,
    grantsAccess,
    expiresAt: period.end,
  });
  await syncProfilePlan(userId, grantsAccess, period.end);

  return { userId, status };
}

/**
 * The screens read profiles.plan (the menu's Premium/Free label, the crowns and
 * Premium badges; user report, 2026-10-23: a live trial showed "Free"), while
 * access is decided by the entitlements. Keep the profile in step: Premium
 * until the period's end while a subscription grants access; Free once nothing
 * grants it any more (a launch-campaign entitlement still counts).
 */
export async function syncProfilePlan(
  userId: string,
  grantsAccess: boolean,
  periodEnd: string | null,
): Promise<void> {
  if (grantsAccess) {
    await supabaseAdmin
      .from("profiles")
      .update({ plan: "premium", plan_expires_at: periodEnd })
      .eq("id", userId);
    return;
  }
  const { hasPremium } = await import("@/lib/premium.server");
  if (await hasPremium(userId)) return;
  await supabaseAdmin
    .from("profiles")
    .update({ plan: "free", plan_expires_at: null })
    .eq("id", userId);
}

/** One entitlement row per (user, feature). Never duplicated. */
export async function reconcileEntitlements(input: {
  userId: string;
  subscriptionId: string | null;
  grantsAccess: boolean;
  expiresAt: string | null;
}): Promise<void> {
  const now = new Date().toISOString();

  // The launch campaign's days live in the same entitlement rows (one per
  // user and feature), so they must survive a subscription: a trial cancelled
  // during the campaign used to revoke the campaign's free days too (audit,
  // 2026-10-24).
  const campaignUntil = await activeCampaignExpiry(input.userId);

  if (input.grantsAccess) {
    const expiresAt =
      input.expiresAt && campaignUntil && Date.parse(campaignUntil) > Date.parse(input.expiresAt)
        ? campaignUntil
        : input.expiresAt;
    const { error } = await supabaseAdmin.from("entitlements").upsert(
      GATED_FEATURES.map((feature) => ({
        user_id: input.userId,
        feature,
        plan: "premium" as const,
        source_subscription_id: input.subscriptionId,
        granted_at: now,
        expires_at: expiresAt,
        revoked_at: null,
      })),
      { onConflict: "user_id,feature" },
    );
    if (error) throw new Error(`entitlement grant failed: ${error.message}`);
    return;
  }

  // A user may hold more than one subscription. Only revoke when no other
  // subscription of theirs still grants access.
  const other = await findOtherGrantingSubscription(input.userId, input.subscriptionId);
  if (other) {
    await reconcileEntitlements({
      userId: input.userId,
      subscriptionId: other.id,
      grantsAccess: true,
      expiresAt: other.current_period_end,
    });
    return;
  }

  if (campaignUntil) {
    // Back to the campaign's own days instead of losing them.
    const { error } = await supabaseAdmin.from("entitlements").upsert(
      GATED_FEATURES.map((feature) => ({
        user_id: input.userId,
        feature,
        plan: "premium" as const,
        source_subscription_id: null,
        granted_at: now,
        expires_at: campaignUntil,
        revoked_at: null,
      })),
      { onConflict: "user_id,feature" },
    );
    if (error) throw new Error(`entitlement campaign restore failed: ${error.message}`);
    return;
  }

  const { error } = await supabaseAdmin
    .from("entitlements")
    .update({ revoked_at: now })
    .eq("user_id", input.userId)
    .eq("plan", "premium")
    .is("revoked_at", null);
  if (error) throw new Error(`entitlement revoke failed: ${error.message}`);
}

/** End of the student's launch-campaign days, when they are still running. */
async function activeCampaignExpiry(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("premium_campaign_grants")
    .select("expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.expires_at ?? null;
}

async function findOtherGrantingSubscription(
  userId: string,
  excludeSubscriptionId: string | null,
): Promise<{ id: string; current_period_end: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("user_id", userId);

  const candidates = (data ?? [])
    .filter((row) => row.id !== excludeSubscriptionId)
    .filter((row) =>
      subscriptionGrantsAccess({
        status: row.status as never,
        current_period_end: row.current_period_end,
      }),
    )
    .sort((a, b) => (b.current_period_end ?? "9999").localeCompare(a.current_period_end ?? "9999"));

  const best = candidates[0];
  return best ? { id: best.id, current_period_end: best.current_period_end } : null;
}
