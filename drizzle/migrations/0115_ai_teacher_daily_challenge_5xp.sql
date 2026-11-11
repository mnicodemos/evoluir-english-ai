-- Award the AI Teacher daily challenge only after the student's recorded
-- teacher practice reaches 10 minutes in a Sao Paulo calendar day.
-- The reward is derived from the existing authoritative activities telemetry:
-- one grouped row per user/day, so repeated visits cannot award duplicate XP.
-- No new table or client-writable reward record is introduced.

CREATE OR REPLACE FUNCTION public.weekly_league_xp_entries(
  p_user_id uuid,
  p_week_start date
)
RETURNS TABLE (
  occurred_at timestamptz,
  activity text,
  xp integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bounds AS (
    SELECT
      (p_week_start::timestamp AT TIME ZONE 'America/Sao_Paulo') AS from_ts,
      ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS to_ts
  ),
  entries AS (
    SELECT
      ul.completed_at AS occurred_at,
      'Lesson completed'::text AS activity,
      50::integer AS xp
    FROM public.user_lessons ul
    CROSS JOIN bounds b
    WHERE ul.user_id = p_user_id
      AND ul.completed_at >= b.from_ts
      AND ul.completed_at < b.to_ts

    UNION ALL

    SELECT
      a.created_at,
      CASE a.activity_type
        WHEN 'writing' THEN 'Writing session'
        WHEN 'listening' THEN 'Listening session'
        WHEN 'daily_reading' THEN 'Daily reading'
        ELSE 'Speaking session'
      END::text,
      20::integer
    FROM public.activities a
    CROSS JOIN bounds b
    WHERE a.user_id = p_user_id
      AND a.activity_type IN (
        'writing',
        'listening',
        'conversation',
        'daily_reading'
      )
      AND a.created_at >= b.from_ts
      AND a.created_at < b.to_ts

    UNION ALL

    SELECT
      uv.last_reviewed_at,
      'Word reviewed'::text,
      2::integer
    FROM public.user_vocabulary uv
    CROSS JOIN bounds b
    WHERE uv.user_id = p_user_id
      AND uv.last_reviewed_at >= b.from_ts
      AND uv.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT
      le.last_reviewed_at,
      'Mistake reviewed'::text,
      5::integer
    FROM public.learning_errors le
    CROSS JOIN bounds b
    WHERE le.user_id = p_user_id
      AND le.last_reviewed_at >= b.from_ts
      AND le.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT
      (sd.day::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'Daily study goal'::text,
      30::integer
    FROM public.study_days sd
    WHERE sd.user_id = p_user_id
      AND sd.day >= p_week_start
      AND sd.day < p_week_start + 7

    UNION ALL

    SELECT
      MAX(a.created_at) AS occurred_at,
      'AI Teacher challenge completed'::text AS activity,
      5::integer AS xp
    FROM public.activities a
    CROSS JOIN bounds b
    WHERE a.user_id = p_user_id
      AND a.activity_type = 'teacher'
      AND a.created_at >= b.from_ts
      AND a.created_at < b.to_ts
    GROUP BY (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date
    HAVING SUM(GREATEST(COALESCE(a.duration_minutes, 0), 0)) >= 10
  )
  SELECT e.occurred_at, e.activity, e.xp
  FROM entries e;
$$;

REVOKE ALL ON FUNCTION
  public.weekly_league_xp_entries(uuid, date)
  FROM PUBLIC, anon, authenticated;

-- Ranking and history still consume this same authoritative XP ledger.
CREATE OR REPLACE FUNCTION public.league_week_xp(
  p_user_id uuid,
  p_week_start date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(entries.xp), 0)::integer
  FROM public.weekly_league_xp_entries(p_user_id, p_week_start) entries;
$$;

REVOKE ALL ON FUNCTION
  public.league_week_xp(uuid, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.weekly_league_xp_breakdown()
RETURNS TABLE (
  occurred_at timestamptz,
  activity text,
  xp integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT entries.occurred_at, entries.activity, entries.xp
  FROM public.weekly_league_xp_entries(
    auth.uid(),
    date_trunc(
      'week',
      now() AT TIME ZONE 'America/Sao_Paulo'
    )::date
  ) entries
  WHERE auth.uid() IS NOT NULL
  ORDER BY entries.occurred_at DESC;
$$;

REVOKE ALL ON FUNCTION
  public.weekly_league_xp_breakdown()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.weekly_league_xp_breakdown()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
