-- One row per daily-push run (word, reminder, weekly), written by the
-- /api/public/cron/daily-push endpoint with the service role. The Admin
-- "Alerts" box reads it to tell when a scheduled push failed or did not run.
-- Students never read it. Idempotent.
CREATE TABLE IF NOT EXISTS public.push_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  devices integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  removed integer NOT NULL DEFAULT 0,
  error text
);

CREATE INDEX IF NOT EXISTS push_runs_created_at_idx ON public.push_runs (created_at DESC);

ALTER TABLE public.push_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_runs FROM anon, authenticated;
GRANT ALL ON public.push_runs TO service_role;

NOTIFY pgrst, 'reload schema';
