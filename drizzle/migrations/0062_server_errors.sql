-- Server errors for the owner (audit item 6): every console.error on the
-- server is stored here as an area and a short message scrubbed of emails,
-- ids and tokens (src/lib/serverErrors.ts), at most once a minute per message.
-- The Admin "Alerts" box sums the last 24 h by area, and five or more errors
-- of one area join the morning alert push. Written and read only by the
-- server (service role); rows older than 30 days are removed by the daily
-- push. No student id is stored. Idempotent.
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
