CREATE TABLE IF NOT EXISTS public.push_cron_key (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  key text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.push_cron_key TO service_role;
ALTER TABLE public.push_cron_key ENABLE ROW LEVEL SECURITY;
INSERT INTO public.push_cron_key (id) VALUES (1) ON CONFLICT DO NOTHING;