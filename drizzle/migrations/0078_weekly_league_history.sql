-- Weekly league history (user request, 2026-10-22: let the student see how
-- their position changed over time). For each of the last p_weeks finished or
-- current weeks (Monday to Sunday, São Paulo) it returns the caller's XP and,
-- when they take part in the league (league_opt_in), their position among the
-- students who take part in their league today (coalesce(max_level, level)),
-- with the same XP rule as weekly_league (league_week_xp). Only the caller's
-- own rows: no other student is exposed. Reviews count by their last review
-- date, so an old week can read a little lower than it did live.
-- Idempotent.

CREATE OR REPLACE FUNCTION public.weekly_league_history(p_weeks integer DEFAULT 8)
RETURNS TABLE (week_start date, xp integer, rank_position integer, members integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_level text;
  v_opt_in boolean;
  v_this_week date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_weeks integer := least(greatest(coalesce(p_weeks, 8), 1), 12);
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  SELECT coalesce(max_level, level), coalesce(league_opt_in, false)
    INTO v_level, v_opt_in
    FROM profiles WHERE id = v_me;
  IF v_level IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH weeks AS (
    SELECT (v_this_week - 7 * g)::date AS ws
    FROM generate_series(0, v_weeks - 1) AS g
  ),
  league_members AS (
    SELECT p.id FROM profiles p
    WHERE coalesce(p.max_level, p.level) = v_level AND (p.league_opt_in OR p.id = v_me)
  ),
  scores AS (
    SELECT w.ws, m.id, public.league_week_xp(m.id, w.ws) AS week_xp
    FROM weeks w CROSS JOIN league_members m
  ),
  ranked AS (
    SELECT s.ws, s.id, s.week_xp,
      (rank() OVER (PARTITION BY s.ws ORDER BY s.week_xp DESC))::integer AS pos,
      (count(*) OVER (PARTITION BY s.ws))::integer AS total
    FROM scores s
    WHERE s.id <> v_me OR v_opt_in
  )
  SELECT w.ws,
    public.league_week_xp(v_me, w.ws),
    CASE WHEN v_opt_in THEN r.pos END,
    CASE WHEN v_opt_in THEN r.total END
  FROM weeks w
  LEFT JOIN ranked r ON r.ws = w.ws AND r.id = v_me
  ORDER BY w.ws DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_league_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_league_history(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
