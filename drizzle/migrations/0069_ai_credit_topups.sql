CREATE TABLE IF NOT EXISTS public.ai_credit_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  added_at timestamptz NOT NULL DEFAULT now(),
  amount_usd numeric(12, 2) NOT NULL CHECK (amount_usd > 0),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_credit_topups_added_at_idx ON public.ai_credit_topups (added_at);

ALTER TABLE public.ai_credit_topups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_credit_topups FROM anon, authenticated;
GRANT ALL ON public.ai_credit_topups TO service_role;