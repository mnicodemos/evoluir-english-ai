-- Study streak fields are written only by the database (credit_study_day and
-- persist_authoritative_legacy_activity, both SECURITY DEFINER). A direct
-- update from the browser may only reset them (Reset progress); any other
-- client value is replaced by the stored one, and a client-created profile
-- always starts with no streak.
-- The function is SECURITY INVOKER on purpose: current_user is then the
-- caller's role ('authenticated'/'anon' for browser requests) and the owner
-- role inside the SECURITY DEFINER writers, which stay allowed.
CREATE OR REPLACE FUNCTION public.protect_profile_streak_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.streak_days := 0;
      NEW.last_activity_date := NULL;
    ELSIF NOT (NEW.streak_days = 0 AND NEW.last_activity_date IS NULL) THEN
      NEW.streak_days := OLD.streak_days;
      NEW.last_activity_date := OLD.last_activity_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_streak_fields_update ON public.profiles;
CREATE TRIGGER profiles_protect_streak_fields_update
BEFORE UPDATE OF streak_days, last_activity_date
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_streak_fields();

DROP TRIGGER IF EXISTS profiles_protect_streak_fields_insert ON public.profiles;
CREATE TRIGGER profiles_protect_streak_fields_insert
BEFORE INSERT
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_streak_fields();
