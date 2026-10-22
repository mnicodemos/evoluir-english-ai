-- Daily reading by choice (user request, 2026-10-22: let the student choose
-- the category and the style of the text). "Today's pick" stays in
-- daily_readings (migration 0072); a chosen category and style is written by
-- the AI for the first student of that level who picks it on that day and
-- stored here for everyone else, like the daily text. Students read; only the
-- server writes. Idempotent.

CREATE TABLE IF NOT EXISTS public.daily_reading_variants (
  day date NOT NULL,
  level text NOT NULL CHECK (level IN ('a1', 'a2', 'b1', 'b2', 'c1', 'c2')),
  category text NOT NULL CHECK (category IN ('daily_life', 'work', 'travel', 'technology', 'wellbeing', 'culture')),
  style text NOT NULL CHECK (style IN ('story', 'article', 'dialogue')),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, level, category, style)
);
ALTER TABLE public.daily_reading_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_reading_variants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.daily_reading_variants TO authenticated;
GRANT ALL ON public.daily_reading_variants TO service_role;
DROP POLICY IF EXISTS "Students read the reading variants" ON public.daily_reading_variants;
CREATE POLICY "Students read the reading variants" ON public.daily_reading_variants
  FOR SELECT TO authenticated USING (true);
NOTIFY pgrst, 'reload schema';
