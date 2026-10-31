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
  /**
   * Warm-up (owner decision, 2026-10-31): Monday 02/11 through Sunday 22/11,
   * São Paulo, right up to the offer.
   */
  warmupStartsAt: "2026-11-02T03:00:00Z",
  /** Exclusive: the warm-up's last day is 22/11, the eve of the offer. */
  warmupEndsAt: "2026-11-23T03:00:00Z",
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

const DAY_MS = 24 * 60 * 60 * 1000;
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The São Paulo calendar day (YYYY-MM-DD) of an instant. */
function saoPauloDay(time: number): string {
  return new Date(time - SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

/** The first and last days of the offer, in São Paulo. */
export const BLACK_FRIDAY_FIRST_DAY = saoPauloDay(Date.parse(BLACK_FRIDAY.startsAt));
export const BLACK_FRIDAY_LAST_DAY = saoPauloDay(Date.parse(BLACK_FRIDAY.endsAt) - 1);
/** The first day of the warm-up, in São Paulo (02/11 with the current dates). */
export const BLACK_FRIDAY_WARMUP_FIRST_DAY = saoPauloDay(Date.parse(BLACK_FRIDAY.warmupStartsAt));

/** A São Paulo day as DD/MM. */
export function dayMonth(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/**
 * Where the campaign stands: the warm-up (the days before, when the app
 * announces it to bring sign-ups in early), live, or nothing.
 */
export function blackFridayPhase(now: Date = new Date()): "warmup" | "live" | null {
  const time = now.getTime();
  if (blackFridayActive(now)) return "live";
  if (
    time >= Date.parse(BLACK_FRIDAY.warmupStartsAt) &&
    time < Date.parse(BLACK_FRIDAY.warmupEndsAt)
  )
    return "warmup";
  return null;
}

/** Whole São Paulo days until the offer starts (1 on its eve). */
export function daysUntilBlackFriday(now: Date = new Date()): number {
  const today = Date.parse(`${saoPauloDay(now.getTime())}T00:00:00Z`);
  const first = Date.parse(`${BLACK_FRIDAY_FIRST_DAY}T00:00:00Z`);
  return Math.max(0, Math.round((first - today) / DAY_MS));
}

/**
 * The morning push to free students on the warm-up's first day (owner
 * decision, 2026-10-31: announce it early) and on the offer's first and last
 * days (owner decision, 2026-10-24), in place of the word of the day; null
 * other days.
 */
export function blackFridayPush(
  today: string,
): { title: string; body: string; path: string } | null {
  const offer = `${BLACK_FRIDAY.monthlyPercentOff}% off no Premium mensal por ${BLACK_FRIDAY.discountMonths} meses + ${BLACK_FRIDAY.monthlyTrialDays} dias grátis na primeira assinatura`;
  if (today === BLACK_FRIDAY_WARMUP_FIRST_DAY) {
    return {
      title: "🖤 A Black Friday do Evoluir+ vem aí",
      body: `De ${dayMonth(BLACK_FRIDAY_FIRST_DAY)} a ${dayMonth(BLACK_FRIDAY_LAST_DAY)}: ${offer}. Já marque na agenda!`,
      path: "/premium",
    };
  }
  if (today === BLACK_FRIDAY_FIRST_DAY) {
    return {
      title: "🖤 A Black Friday começou!",
      body: `${offer}. Até ${dayMonth(BLACK_FRIDAY_LAST_DAY)}.`,
      path: "/premium",
    };
  }
  if (today === BLACK_FRIDAY_LAST_DAY) {
    return {
      title: "⏰ Último dia de Black Friday",
      body: `Hoje é a última chance: ${offer}.`,
      path: "/premium",
    };
  }
  return null;
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
