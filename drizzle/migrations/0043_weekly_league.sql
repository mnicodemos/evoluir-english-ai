-- Weekly league: an opt-in ranking per CEFR level. XP is computed here from
-- the same evidence the rest of the app trusts, never sent by the browser.
-- Week: Monday 00:00 to Sunday 23:59, America/Sao_Paulo.
--   lesson completed 50 · writing / listening / speaking session 20 each
--   vocabulary word reviewed 2 · "My mistakes" item reviewed 5
--   day with the daily goal met (same rule as credit_study_day) +30
-- Other students are shown only by first name + initial, and only when they
-- joined the league (league_opt_in).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS league_opt_in boolean NOT NULL DEFAULT false;

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
  )::integer;
$$;

REVOKE ALL ON FUNCTION public.league_week_xp(uuid, date) FROM PUBLIC, anon, authenticated;

-- Ranking of the caller's level for the current week: the top 20 students who
-- joined, plus the caller's own row (ranked only if they joined).
CREATE OR REPLACE FUNCTION public.weekly_league()
RETURNS TABLE (rank_position integer, display_name text, xp integer, is_me boolean, joined boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_level text;
  v_week date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  SELECT level INTO v_level FROM profiles WHERE id = v_me;
  IF v_level IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH members AS (
    SELECT p.id, p.name, p.league_opt_in, public.league_week_xp(p.id, v_week) AS week_xp
    FROM profiles p
    WHERE p.level = v_level AND (p.league_opt_in OR p.id = v_me)
  ),
  ranked AS (
    SELECT m.*,
      CASE WHEN m.league_opt_in
        THEN (rank() OVER (PARTITION BY m.league_opt_in ORDER BY m.week_xp DESC))::integer
      END AS pos
    FROM members m
  )
  SELECT r.pos,
    trim(initcap(split_part(btrim(coalesce(r.name, '')), ' ', 1)) || ' ' ||
      CASE WHEN split_part(btrim(coalesce(r.name, '')), ' ', 2) <> ''
        THEN upper(left(split_part(btrim(coalesce(r.name, '')), ' ', 2), 1)) || '.'
        ELSE '' END),
    r.week_xp,
    r.id = v_me,
    r.league_opt_in
  FROM ranked r
  WHERE r.id = v_me OR (r.league_opt_in AND r.pos <= 20)
  ORDER BY r.pos NULLS LAST, r.week_xp DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_league() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_league() TO authenticated;

NOTIFY pgrst, 'reload schema';
