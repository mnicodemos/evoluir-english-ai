-- Award English Adventures completion XP once per student and CEFR journey.
-- The grant is server-owned and contributes to the existing weekly league total.

CREATE TABLE IF NOT EXISTS public.english_adventure_xp_awards (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('a1', 'a2')),
  xp integer NOT NULL DEFAULT 50 CHECK (xp = 50),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

ALTER TABLE public.english_adventure_xp_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.english_adventure_xp_awards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.english_adventure_xp_awards TO service_role;

CREATE OR REPLACE FUNCTION public.award_english_adventure_completion_xp(p_user_id uuid, p_level text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed integer;
BEGIN
  IF p_user_id IS NULL OR p_level NOT IN ('a1', 'a2') THEN
    RAISE EXCEPTION 'Invalid English Adventures reward request';
  END IF;

  SELECT count(*) INTO v_completed
  FROM public.english_adventure_checkpoints
  WHERE user_id = p_user_id
    AND adventure_id IN (
      CASE WHEN p_level = 'a1' THEN 'a1-welcome-mix-up' ELSE 'a2-surprise-delivery' END,
      CASE WHEN p_level = 'a1' THEN 'a1-neighbourhood-mystery' ELSE 'a2-community-festival' END
    )
    AND completed = true;

  IF v_completed < 2 THEN
    RETURN false;
  END IF;

  INSERT INTO public.english_adventure_xp_awards (user_id, level, xp)
  VALUES (p_user_id, p_level, 50)
  ON CONFLICT (user_id, level) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.award_english_adventure_completion_xp(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_english_adventure_completion_xp(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.league_week_xp(p_user_id uuid, p_week_start date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT (p_week_start::timestamp AT TIME ZONE 'America/Sao_Paulo') AS from_ts,
           ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS to_ts
  ),
  days AS (
    SELECT generate_series(p_week_start, p_week_start + 6, interval '1 day')::date AS d
  )
  SELECT (
    50 * (SELECT count(*) FROM user_lessons, bounds
          WHERE user_id = p_user_id AND completed_at >= from_ts AND completed_at < to_ts)
    + 20 * (SELECT count(*) FROM activities, bounds
          WHERE user_id = p_user_id AND activity_type IN ('writing', 'listening', 'conversation')
            AND created_at >= from_ts AND created_at < to_ts)
    + 2 * (SELECT count(*) FROM user_vocabulary, bounds
          WHERE user_id = p_user_id AND last_reviewed_at >= from_ts AND last_reviewed_at < to_ts)
    + 5 * (SELECT count(*) FROM learning_errors, bounds
          WHERE user_id = p_user_id AND last_reviewed_at >= from_ts AND last_reviewed_at < to_ts)
    + 30 * (SELECT count(*) FROM days WHERE
          (SELECT count(*) FROM activities WHERE user_id = p_user_id AND activity_type = 'writing'
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = days.d) >= 3
          OR (SELECT count(*) FROM activities WHERE user_id = p_user_id AND activity_type = 'listening'
             AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = days.d) >= 3
          OR (SELECT count(*) FROM user_vocabulary WHERE user_id = p_user_id
             AND (last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = days.d) >= 10
          OR EXISTS (SELECT 1 FROM user_lessons WHERE user_id = p_user_id
             AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = days.d))
    + COALESCE((SELECT sum(xp) FROM english_adventure_xp_awards, bounds
          WHERE user_id = p_user_id AND awarded_at >= from_ts AND awarded_at < to_ts), 0)
  )::integer;
$$;

REVOKE ALL ON FUNCTION public.league_week_xp(uuid, date) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
