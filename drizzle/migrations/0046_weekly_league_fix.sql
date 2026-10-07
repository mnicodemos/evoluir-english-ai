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
  SELECT coalesce(max_level, level) INTO v_level FROM profiles WHERE id = v_me;
  IF v_level IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH members AS (
    SELECT p.id, p.name, p.league_opt_in, public.league_week_xp(p.id, v_week) AS week_xp
    FROM profiles p
    WHERE coalesce(p.max_level, p.level) = v_level AND (p.league_opt_in OR p.id = v_me)
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