/**
 * Black Friday offer (owner decision, 2026-10-24: with no students yet, the
 * offer goes to the monthly plan, not the yearly): while the campaign runs,
 * the monthly plan is 30% off its first 3 paid months and its free trial is
 * 15 days instead of 7. The trial stays once per account (trial.ts); the
 * discount applies to anyone subscribing monthly in the period. The yearly
 * plan keeps its usual price and trial. The server decides at checkout
 * (checkoutOffer); the Premium page only shows it.
 */
import type { BillingInterval } from "./stripeMapping";
import { TRIAL_DAYS, trialEligible } from "./trial";

export const BLACK_FRIDAY = {
  /** 23/11/2026 00:00 in São Paulo (UTC-3). */
  startsAt: "2026-11-23T03:00:00Z",
  /** Exclusive: the offer runs through 30/11 (Cyber Monday), São Paulo. */
  endsAt: "2026-12-01T03:00:00Z",
  /** The last day shown on the Premium page. */
  lastDay: "2026-11-30T15:00:00Z",
  monthlyPercentOff: 30,
  /** Paid months the discount covers; the 4th is full price. */
  discountMonths: 3,
  monthlyTrialDays: 15,
  /** Stripe coupon, created on first use (ensureBlackFridayCoupon). */
  couponId: "EVOLUIR_BF2026_MONTHLY30X3",
} as const;

/** Prices in cents, as on the Premium page (Stripe holds the real prices). */
export const PLAN_PRICE_CENTS: Record<BillingInterval, number> = {
  monthly: 7990,
  yearly: 79990,
};

export function blackFridayActive(now: Date = new Date()): boolean {
  const time = now.getTime();
  return time >= Date.parse(BLACK_FRIDAY.startsAt) && time < Date.parse(BLACK_FRIDAY.endsAt);
}

export type CheckoutOffer = {
  /** Free days before the first charge, or null for no trial. */
  trialDays: number | null;
  /** Stripe coupon to apply, or null. */
  couponId: string | null;
};

export function checkoutOffer(
  interval: BillingInterval,
  pastSubscriptions: readonly unknown[],
  now: Date = new Date(),
): CheckoutOffer {
  const campaign = blackFridayActive(now);
  const trialDays = trialEligible(pastSubscriptions)
    ? campaign && interval === "monthly"
      ? BLACK_FRIDAY.monthlyTrialDays
      : TRIAL_DAYS
    : null;
  const couponId = campaign && interval === "monthly" ? BLACK_FRIDAY.couponId : null;
  return { trialDays, couponId };
}

/** The first charges of a plan, in cents, with the offer's discount. */
export function offerPriceCents(interval: BillingInterval, offer: CheckoutOffer): number {
  const cents = PLAN_PRICE_CENTS[interval];
  return offer.couponId
    ? Math.round((cents * (100 - BLACK_FRIDAY.monthlyPercentOff)) / 100)
    : cents;
}

export function formatBrl(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `R$ ${reais.toLocaleString("pt-BR")},${rest}`;
}
