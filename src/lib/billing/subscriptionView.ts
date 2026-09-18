/**
 * Phase 7: read-only presentation of the access snapshot returned by
 * getMyAccess. Pure functions only — the server/database stays the authority
 * for plan, status and Premium access. Nothing here grants access.
 */
import {
  entitlementIsActive,
  subscriptionGrantsAccess,
  type Entitlement,
  type Subscription,
  type SubscriptionStatus,
} from "./contracts";

export type BillingInterval = "monthly" | "yearly";

export type SubscriptionView = {
  /** Premium only when a valid entitlement exists (server authority). */
  plan: "free" | "premium";
  /** Status of the most relevant subscription, or null when there is none. */
  status: SubscriptionStatus | null;
  interval: BillingInterval | null;
  /** End of the currently granted access period, when known. */
  accessUntil: string | null;
  /** A Stripe customer exists, so the Customer Portal can be opened. */
  canManage: boolean;
  /** Access still valid although the subscription was canceled. */
  canceledButActive: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function intervalFromPeriod(
  subscription: Pick<Subscription, "current_period_start" | "current_period_end">,
): BillingInterval | null {
  const { current_period_start: start, current_period_end: end } = subscription;
  if (!start || !end) return null;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / DAY;
  if (!Number.isFinite(days) || days <= 0) return null;
  return days > 200 ? "yearly" : "monthly";
}

/** Pick the subscription that best describes the user's current situation. */
function pickSubscription(subscriptions: Subscription[], now: Date): Subscription | null {
  const granting = subscriptions.filter((s) => subscriptionGrantsAccess(s, now));
  const pool = granting.length ? granting : subscriptions;
  return (
    [...pool].sort((a, b) =>
      (b.current_period_end ?? b.started_at ?? "").localeCompare(
        a.current_period_end ?? a.started_at ?? "",
      ),
    )[0] ?? null
  );
}

export function buildSubscriptionView(
  access: { subscriptions: Subscription[]; entitlements: Entitlement[] },
  now: Date = new Date(),
): SubscriptionView {
  const active = access.entitlements.filter((e) => entitlementIsActive(e, now));
  const subscription = pickSubscription(access.subscriptions, now);

  const expiries = active
    .map((e) => e.expires_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    plan: active.length > 0 ? "premium" : "free",
    status: subscription?.status ?? null,
    interval: subscription ? intervalFromPeriod(subscription) : null,
    accessUntil: expiries.length ? (expiries[expiries.length - 1] ?? null) : null,
    canManage: access.subscriptions.some((s) => Boolean(s.provider_customer_id)),
    canceledButActive: active.length > 0 && subscription?.status === "canceled",
  };
}
