CREATE TABLE IF NOT EXISTS public.server_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  area text NOT NULL,
  message text NOT NULL
);
CREATE INDEX IF NOT EXISTS server_errors_created_at_idx ON public.server_errors (created_at DESC);
ALTER TABLE public.server_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_errors FROM anon, authenticated;
GRANT ALL ON public.server_errors TO service_role;
NOTIFY pgrst, 'reload schema';