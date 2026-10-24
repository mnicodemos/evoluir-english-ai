/**
 * Pure Stripe <-> internal mapping. No SDK, no secrets, no I/O — safe to test
 * and safe to import anywhere. The internal statuses come from Phase 6A
 * contracts; no new states are invented here.
 */
import type { SubscriptionStatus } from "./contracts";

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** Environment variable holding the Stripe price id for each allowed plan. */
export const PRICE_ENV_BY_INTERVAL: Record<BillingInterval, string> = {
  monthly: "STRIPE_PRICE_PREMIUM_MONTHLY",
  yearly: "STRIPE_PRICE_PREMIUM_YEARLY",
};

/**
 * The client may only send an interval keyword. Price ids live on the server.
 */
export function resolvePriceId(
  interval: BillingInterval,
  env: Record<string, string | undefined>,
): string {
  const name = PRICE_ENV_BY_INTERVAL[interval];
  const priceId = env[name];
  if (!priceId) throw new Error(`Missing Stripe price configuration: ${name}`);
  return priceId;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trial",
  past_due: "payment_failed",
  unpaid: "payment_failed",
  incomplete: "payment_failed",
  incomplete_expired: "expired",
  paused: "expired",
  canceled: "canceled",
};

/** Unknown Stripe statuses never silently grant access. */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  return STATUS_MAP[stripeStatus] ?? "expired";
}

export function secondsToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * A saved Stripe customer that this key cannot see (user report, 2026-10-23:
 * after the switch to live keys, checkout answered 400 "No such customer ...
 * a similar object exists in test mode"). Stripe answers resource_missing
 * for it; the caller then creates a new customer instead of failing.
 */
export function isMissingStripeCustomer(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, param } = error as { code?: unknown; param?: unknown };
  return (
    code === "resource_missing" && (param === undefined || param === "customer" || param === "id")
  );
}
