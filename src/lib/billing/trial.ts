/**
 * Premium free trial (user request, 2026-10-22): 7 days free on the first
 * subscription of an account, monthly or yearly. Stripe collects the card at
 * checkout, keeps the subscription "trialing" (our "trial", which grants
 * Premium) and charges on day 8 unless the student cancels before; without a
 * payment method the subscription is cancelled instead of left unpaid. One
 * trial per account: any earlier subscription, in any status, rules it out.
 * The server decides (createStripeCheckoutSession); the page only shows it.
 */
export const TRIAL_DAYS = 7;

export function trialEligible(pastSubscriptions: readonly unknown[]): boolean {
  return pastSubscriptions.length === 0;
}
