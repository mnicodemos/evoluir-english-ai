-- Restore automatic Bronze awards and reconcile students with proven credited study days.
-- This is a forward-only repair: it does not rewrite prior migrations, change streaks,
-- consume freezes, or remove/recalculate any existing permanent award.

CREATE OR REPLACE FUNCTION public.grant_bronze_for_credited_study_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_activity_date IS NULL
     OR NEW.streak_days IS NULL
     OR NEW.streak_days < 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
  VALUES (NEW.id, 0, 'bronze')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_bronze_for_credited_study_day()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bronze_for_credited_study_day()
  TO service_role;

DROP TRIGGER IF EXISTS profiles_grant_bronze_for_credited_study_day
  ON public.profiles;

CREATE TRIGGER profiles_grant_bronze_for_credited_study_day
AFTER UPDATE OF last_activity_date ON public.profiles
FOR EACH ROW
WHEN (NEW.last_activity_date IS DISTINCT FROM OLD.last_activity_date)
EXECUTE FUNCTION public.grant_bronze_for_credited_study_day();

-- Historical repair uses immutable credited-study-day evidence only.
-- A student needs at least one row in study_days to receive Bronze.
-- ON CONFLICT DO NOTHING preserves all existing awards and makes this idempotent.
INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
SELECT DISTINCT sd.user_id, 0, 'bronze'
FROM public.study_days AS sd
INNER JOIN public.profiles AS p ON p.id = sd.user_id
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
