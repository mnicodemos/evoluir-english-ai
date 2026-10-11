-- One record of study days (user request: the jewels, Your learning rhythm and
-- the My Progress calendar must agree). credit_study_day, the only writer of
-- the streak, now also stores each day it credits in study_days, and the
-- Rhythm card and the calendar read that table, so a day marked there is
-- exactly a day the jewels counted. Before, the screens recomputed the rule
-- from today's evidence, and a word reviewed again later moved its
-- last_reviewed_at, so an old 10-word day could vanish from the calendar
-- while the streak had counted it.
-- Students only read their own rows; only the database writes them.
-- Idempotent: IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS public.study_days (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_days FROM anon, authenticated;
GRANT SELECT ON public.study_days TO authenticated;
GRANT ALL ON public.study_days TO service_role;

DROP POLICY IF EXISTS "Students read their own study days" ON public.study_days;
CREATE POLICY "Students read their own study days" ON public.study_days
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Same rule as migration 0057; the only change is the INSERT into study_days.
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
    OR EXISTS (SELECT 1 FROM public.user_lessons
       WHERE user_id = p_user_id AND completed_at IS NOT NULL
         AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR (EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today)
        AND NOT EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today AND done_at IS NULL));

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

    INSERT INTO public.study_days (user_id, day)
    VALUES (p_user_id, v_today)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

-- History before this migration: the days the rule finds in the evidence that
-- is still there, plus each student's last credited day.
INSERT INTO public.study_days (user_id, day)
SELECT user_id, day FROM (
  SELECT user_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day
  FROM public.activities
  WHERE activity_type IN ('writing', 'listening', 'conversation')
  GROUP BY 1, 2, activity_type
  HAVING activity_type = 'conversation' OR count(*) >= 3
  UNION
  SELECT user_id, (completed_at AT TIME ZONE 'America/Sao_Paulo')::date
  FROM public.user_lessons
  WHERE completed_at IS NOT NULL
  UNION
  SELECT user_id, (last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date
  FROM public.user_vocabulary
  WHERE last_reviewed_at IS NOT NULL
  GROUP BY 1, 2
  HAVING count(*) >= 10
  UNION
  SELECT user_id, day
  FROM public.plus_goal_steps
  GROUP BY 1, 2
  HAVING bool_and(done_at IS NOT NULL)
  UNION
  SELECT id, last_activity_date
  FROM public.profiles
  WHERE last_activity_date IS NOT NULL
) AS evidence
WHERE user_id IS NOT NULL AND day IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = evidence.user_id)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
