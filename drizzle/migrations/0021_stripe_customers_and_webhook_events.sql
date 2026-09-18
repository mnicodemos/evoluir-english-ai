-- Stripe integration support tables. No card data is ever stored; only opaque Stripe IDs.

CREATE TABLE public.stripe_customers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_customers TO service_role;

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON public.stripe_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Minimal idempotency ledger for Stripe webhooks. No payload is persisted.
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','processed','failed','ignored')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  duration_ms integer
);

CREATE INDEX stripe_webhook_events_type_idx ON public.stripe_webhook_events (event_type, received_at DESC);

GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX subscriptions_provider_customer_idx
  ON public.subscriptions (provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;