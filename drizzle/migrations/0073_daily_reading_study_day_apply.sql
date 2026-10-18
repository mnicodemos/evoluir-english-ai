-- Daily reading closes a study day (user decision, 2026-10-17): answering every
-- question of the day's reading (any score) counts, like finishing a lesson.
-- The server records it as an activities row of type 'daily_reading'
-- (completeDailyReading); its minutes stay in the 'reading' telemetry rows.
-- Same credit_study_day as migration 0063 plus that clause, and the activities
-- trigger also fires for 'daily_reading'. Idempotent.

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
    OR EXISTS (SELECT 1 FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'conversation'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR EXISTS (SELECT 1 FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'daily_reading'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR EXISTS (SELECT 1 FROM public.user_lessons
       WHERE user_id = p_user_id AND completed_at IS NOT NULL
         AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR (EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today)
        AND NOT EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today AND done_at IS NULL));

  IF v_ok THEN
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

    INSERT INTO public.study_days (user_id, day)
    VALUES (p_user_id, v_today)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_study_day_activities ON public.activities;
CREATE TRIGGER credit_study_day_activities
AFTER INSERT ON public.activities
FOR EACH ROW WHEN (NEW.activity_type IN ('writing','listening','conversation','daily_reading'))
EXECUTE FUNCTION public.credit_study_day_trigger();

NOTIFY pgrst, 'reload schema';