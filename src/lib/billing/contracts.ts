/**
 * Provider-agnostic monetisation contracts (Phase 6A foundation).
 *
 * No gateway, no checkout, no payment data. These types describe the shape the
 * future integration must fill in: USER -> SUBSCRIPTION -> ENTITLEMENT -> FEATURE.
 */

export const SUBSCRIPTION_PLANS = ["free", "premium"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "canceled",
  "expired",
  "payment_failed",
  "refunded",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that may grant access. Payment success alone never grants access. */
export const ACCESS_GRANTING_STATUSES: readonly SubscriptionStatus[] = ["active", "trial"];

/** Features that already exist in the product and can be gated later. */
export const GATED_FEATURES = [
  "ai_teacher",
  "ai_talking",
  "writing_correction",
  "advanced_reports",
] as const;
export type GatedFeature = (typeof GATED_FEATURES)[number];

/** Current, documented reality: nothing is hard-gated yet; only AI quotas differ. */
export const FEATURE_PLAN_MAP: Record<GatedFeature, SubscriptionPlan> = {
  ai_teacher: "free",
  ai_talking: "free",
  writing_correction: "free",
  advanced_reports: "free",
};

export type Subscription = {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
};

export type Entitlement = {
  feature: string;
  plan: SubscriptionPlan;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/** A subscription only grants access while its status and period are valid. */
export function subscriptionGrantsAccess(
  subscription: Pick<Subscription, "status" | "current_period_end">,
  now: Date = new Date(),
): boolean {
  if (!ACCESS_GRANTING_STATUSES.includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > now.getTime();
}

/** Mirrors public.has_active_entitlement; the database remains the authority. */
export function entitlementIsActive(entitlement: Entitlement, now: Date = new Date()): boolean {
  if (entitlement.revoked_at) return false;
  if (!entitlement.expires_at) return true;
  return new Date(entitlement.expires_at).getTime() > now.getTime();
}

export function activeFeatures(entitlements: Entitlement[], now: Date = new Date()): string[] {
  return entitlements.filter((e) => entitlementIsActive(e, now)).map((e) => e.feature);
}
