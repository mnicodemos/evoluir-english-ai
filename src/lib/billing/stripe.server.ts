import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-only Stripe client. The secret key never leaves the server. */
export function getStripe(): Stripe {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  if (secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe keys are not allowed in this phase; use a test key.");
  }
  client ??= new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("Stripe webhook is not configured (missing STRIPE_WEBHOOK_SECRET).");
  return secret;
}
