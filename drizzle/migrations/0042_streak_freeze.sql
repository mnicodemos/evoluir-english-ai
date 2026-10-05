-- Streak protection: one missed study day per week (Monday to Sunday,
-- America/Sao_Paulo) does not break the streak. The day it covered is stored
-- in streak_freeze_used_on, written only by credit_study_day like the other
-- streak fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_used_on date NULL;

CREATE OR REPLACE FUNCTION public.credit_study_day(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_missed date := v_today - 1;
  v_profile public.profiles%ROWTYPE;
  v_ok boolean;
  v_frozen boolean;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.last_activity_date = v_today THEN RETURN; END IF;

  v_ok :=
    (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'writing'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'listening'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.user_vocabulary
       WHERE user_id = p_user_id AND last_reviewed_at IS NOT NULL
         AND (last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 10
    OR EXISTS (SELECT 1 FROM public.user_lessons
       WHERE user_id = p_user_id AND completed_at IS NOT NULL
         AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today);

  IF v_ok THEN
    -- Exactly one day missed, and no protection used yet in that day's week.
    v_frozen := v_profile.last_activity_date = v_today - 2
      AND v_profile.streak_days > 0
      AND (v_profile.streak_freeze_used_on IS NULL
           OR v_profile.streak_freeze_used_on < date_trunc('week', v_missed)::date);

    UPDATE public.profiles
    SET streak_days = CASE
          WHEN last_activity_date = v_missed OR v_frozen THEN streak_days + 1
          ELSE 1
        END,
        streak_freeze_used_on = CASE WHEN v_frozen THEN v_missed ELSE streak_freeze_used_on END,
        last_activity_date = v_today
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

-- The browser can no longer write the protection day either.
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
      NEW.streak_freeze_used_on := NULL;
    ELSE
      NEW.streak_freeze_used_on := OLD.streak_freeze_used_on;
      IF NOT (NEW.streak_days = 0 AND NEW.last_activity_date IS NULL) THEN
        NEW.streak_days := OLD.streak_days;
        NEW.last_activity_date := OLD.last_activity_date;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_streak_fields_update ON public.profiles;
CREATE TRIGGER profiles_protect_streak_fields_update
BEFORE UPDATE OF streak_days, last_activity_date, streak_freeze_used_on
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_streak_fields();
