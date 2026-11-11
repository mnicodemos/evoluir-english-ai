-- Restrict shared pedagogical content to server-side access only.
-- Students receive only the content selected by authenticated server functions.
-- Admin video management remains server-side and service_role retains full access.

DO $$
BEGIN
  IF to_regclass('public.daily_readings') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.daily_readings FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.daily_readings TO service_role;
    DROP POLICY IF EXISTS "Students read the daily readings" ON public.daily_readings;
  END IF;

  IF to_regclass('public.daily_reading_variants') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.daily_reading_variants FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.daily_reading_variants TO service_role;
    DROP POLICY IF EXISTS "Students read the reading variants" ON public.daily_reading_variants;
  END IF;

  IF to_regclass('public.level_intro_videos') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.level_intro_videos FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.level_intro_videos TO service_role;
    DROP POLICY IF EXISTS "Signed-in students read level intro videos" ON public.level_intro_videos;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
