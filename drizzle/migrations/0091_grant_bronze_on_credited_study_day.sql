-- Grant Bronze from the authoritative credited-study-day path, even when a streak resets to 1.
-- credit_study_day updates profiles.last_activity_date only after a valid study day is confirmed.
-- This complements the streak-threshold trigger in 0090 and does not backfill historical awards.
CREATE OR REPLACE FUNCTION public.grant_bronze_for_credited_study_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_activity_date IS NULL OR NEW.streak_days IS NULL OR NEW.streak_days < 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
  VALUES (NEW.id, 0, 'bronze')
  ON CONFLICT (user_id, jewel_index) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_bronze_for_credited_study_day() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bronze_for_credited_study_day() TO service_role;

DROP TRIGGER IF EXISTS profiles_grant_bronze_for_credited_study_day ON public.profiles;
CREATE TRIGGER profiles_grant_bronze_for_credited_study_day
AFTER UPDATE OF last_activity_date ON public.profiles
FOR EACH ROW
WHEN (NEW.last_activity_date IS DISTINCT FROM OLD.last_activity_date)
EXECUTE FUNCTION public.grant_bronze_for_credited_study_day();

NOTIFY pgrst, 'reload schema';
