-- Restore the 5 XP credit for completed Extra Videos in the single
-- Weekly League ledger. Shorts are deliberately excluded.
-- One row per student/video/Sao Paulo day is enforced by migration 0104.

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
      p_week_start::timestamp
        AT TIME ZONE 'America/Sao_Paulo' AS from_ts,
      (p_week_start + 7)::timestamp
        AT TIME ZONE 'America/Sao_Paulo' AS to_ts
  ),
  days AS (
    SELECT generate_series(
      p_week_start,
      p_week_start + 6,
      interval '1 day'
    )::date AS day
  ),
  daily_goals AS (
    SELECT
      d.day::timestamp
        AT TIME ZONE 'America/Sao_Paulo' AS occurred_at,
      'Daily study goal'::text AS activity,
      30::integer AS xp
    FROM days d
    WHERE
      (
        SELECT count(*)
        FROM public.activities a
        WHERE a.user_id = p_user_id
          AND a.activity_type = 'writing'
          AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d.day
      ) >= 3
      OR
      (
        SELECT count(*)
        FROM public.activities a
        WHERE a.user_id = p_user_id
          AND a.activity_type = 'listening'
          AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = d.day
      ) >= 3
      OR
      (
        SELECT count(*)
        FROM public.user_vocabulary uv
        WHERE uv.user_id = p_user_id
          AND (uv.last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = d.day
      ) >= 10
      OR EXISTS (
        SELECT 1
        FROM public.user_lessons ul
        WHERE ul.user_id = p_user_id
          AND (ul.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = d.day
      )
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
        ELSE 'Speaking session'
      END::text,
      20::integer
    FROM public.activities a
    CROSS JOIN bounds b
    WHERE a.user_id = p_user_id
      AND a.activity_type IN ('writing', 'listening', 'conversation')
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
      pvv.created_at,
      'Extra video watched'::text,
      5::integer
    FROM public.premium_video_views pvv
    INNER JOIN public.premium_level_videos plv
      ON plv.id = pvv.video_id
    CROSS JOIN bounds b
    WHERE pvv.user_id = p_user_id
      AND plv.kind = 'video'
      AND pvv.created_at >= b.from_ts
      AND pvv.created_at < b.to_ts

    UNION ALL

    SELECT
      dg.occurred_at,
      dg.activity,
      dg.xp
    FROM daily_goals dg
  )
  SELECT
    e.occurred_at,
    e.activity,
    e.xp
  FROM entries e;
$$;

-- Keep the internal ledger inaccessible to clients.
REVOKE ALL ON FUNCTION
  public.weekly_league_xp_entries(uuid, date)
  FROM PUBLIC, anon, authenticated;

-- The total and the detail popup continue to read the same exact entries.
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
  SELECT COALESCE(SUM(e.xp), 0)::integer
  FROM public.weekly_league_xp_entries(
    p_user_id,
    p_week_start
  ) e;
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
  SELECT
    e.occurred_at,
    e.activity,
    e.xp
  FROM public.weekly_league_xp_entries(
    auth.uid(),
    date_trunc(
      'week',
      now() AT TIME ZONE 'America/Sao_Paulo'
    )::date
  ) e
  WHERE auth.uid() IS NOT NULL
  ORDER BY e.occurred_at DESC;
$$;

REVOKE ALL ON FUNCTION
  public.weekly_league_xp_breakdown()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.weekly_league_xp_breakdown()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
