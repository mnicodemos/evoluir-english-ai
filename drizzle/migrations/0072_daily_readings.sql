CREATE TABLE IF NOT EXISTS public.daily_readings (
  day date NOT NULL,
  level text NOT NULL CHECK (level IN ('a1', 'a2', 'b1', 'b2', 'c1', 'c2')),
  theme text NOT NULL CHECK (theme IN ('motivational', 'story')),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, level)
);
ALTER TABLE public.daily_readings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_readings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.daily_readings TO authenticated;
GRANT ALL ON public.daily_readings TO service_role;
DROP POLICY IF EXISTS "Students read the daily readings" ON public.daily_readings;
CREATE POLICY "Students read the daily readings" ON public.daily_readings
  FOR SELECT TO authenticated USING (true);
NOTIFY pgrst, 'reload schema';