-- Evoluir+ Plus: the student picks 1 to 3 personal goals ("speak English in
-- meetings", "save R$ 300 a month", "walk 3 times a week"); EVO gives one
-- small step per goal each day. Finishing every step of the day also counts as
-- a study day, so English and the goals share one streak (credit_study_day).
-- Students only read their own rows; writes go through the server (service
-- role), which also caps active goals at 3. Idempotent.

CREATE TABLE IF NOT EXISTS public.plus_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  area text NOT NULL DEFAULT 'other' CHECK (area IN ('english', 'money', 'health', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS plus_goals_active_idx
  ON public.plus_goals (user_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.plus_goal_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.plus_goals (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- São Paulo calendar day, like every other study day.
  day date NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 240),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, day)
);

CREATE INDEX IF NOT EXISTS plus_goal_steps_user_day_idx
  ON public.plus_goal_steps (user_id, day DESC);

ALTER TABLE public.plus_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plus_goal_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_goals, public.plus_goal_steps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plus_goals, public.plus_goal_steps TO authenticated;
GRANT ALL ON public.plus_goals, public.plus_goal_steps TO service_role;

DROP POLICY IF EXISTS "Students read their own goals" ON public.plus_goals;
CREATE POLICY "Students read their own goals"
  ON public.plus_goals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students read their own goal steps" ON public.plus_goal_steps;
CREATE POLICY "Students read their own goal steps"
  ON public.plus_goal_steps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- At most 3 active goals per student, whoever writes the row.
CREATE OR REPLACE FUNCTION public.plus_goals_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.archived_at IS NULL AND (
    SELECT count(*) FROM public.plus_goals
    WHERE user_id = NEW.user_id AND archived_at IS NULL AND id <> NEW.id
  ) >= 3 THEN
    RAISE EXCEPTION 'plus_goal_limit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plus_goals_limit ON public.plus_goals;
CREATE TRIGGER plus_goals_limit
BEFORE INSERT OR UPDATE OF archived_at ON public.plus_goals
FOR EACH ROW EXECUTE FUNCTION public.plus_goals_limit();

-- The study-day rule gains one source: every Plus step of the day done.
-- Everything else is unchanged from 0042_streak_freeze.
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
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_study_day_plus_goal_steps ON public.plus_goal_steps;
CREATE TRIGGER credit_study_day_plus_goal_steps
AFTER UPDATE OF done_at ON public.plus_goal_steps
FOR EACH ROW WHEN (NEW.done_at IS NOT NULL)
EXECUTE FUNCTION public.credit_study_day_trigger();

NOTIFY pgrst, 'reload schema';
