-- Public home funnel: anonymous daily counters of visits and "Começar" clicks,
-- read in Admin → Retenção next to signups. No cookie, no user id, no IP: one
-- number per day and event (São Paulo date), as the Privacy Policy promises.
-- The page bumps a counter through bump_landing_stat (anon may call it, only
-- for the two known events); only the service role reads the table. Idempotent.

CREATE TABLE IF NOT EXISTS public.landing_daily_stats (
  day date NOT NULL,
  event text NOT NULL CHECK (event IN ('visit', 'signup_click')),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);

ALTER TABLE public.landing_daily_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_daily_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.landing_daily_stats TO service_role;

CREATE OR REPLACE FUNCTION public.bump_landing_stat(p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN ('visit', 'signup_click') THEN
    RETURN;
  END IF;
  INSERT INTO public.landing_daily_stats (day, event, count)
  VALUES ((now() AT TIME ZONE 'America/Sao_Paulo')::date, p_event, 1)
  ON CONFLICT (day, event) DO UPDATE SET count = public.landing_daily_stats.count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_landing_stat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_landing_stat(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
