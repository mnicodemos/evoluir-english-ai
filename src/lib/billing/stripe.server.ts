import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-only Stripe client. The secret key never leaves the server. */
export function getStripe(): Stripe {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  // Live keys are allowed (owner decision, 2026-10-23: real payments start);
  // the test phase refused sk_live_ keys here.
  client ??=new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("Stripe webhook is not configured (missing STRIPE_WEBHOOK_SECRET).");
  return secret;
}
