-- Detailed, caller-only ledger for the current Weekly League week.
-- Mirrors league_week_xp (including the daily-goal bonus and extra-video XP).
-- No client-supplied user id or XP values are accepted.
CREATE OR REPLACE FUNCTION public.weekly_league_xp_breakdown()
RETURNS TABLE (occurred_at timestamptz, activity text, xp integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller AS (
    SELECT auth.uid() AS user_id,
           date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date AS week_start
  ),
  bounds AS (
    SELECT user_id, week_start,
           (week_start::timestamp AT TIME ZONE 'America/Sao_Paulo') AS from_ts,
           ((week_start + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS to_ts
    FROM caller
    WHERE user_id IS NOT NULL
  ),
  entries AS (
    SELECT ul.completed_at AS occurred_at, 'Lesson completed'::text AS activity, 50::integer AS xp
    FROM user_lessons ul CROSS JOIN bounds b
    WHERE ul.user_id = b.user_id AND ul.completed_at >= b.from_ts AND ul.completed_at < b.to_ts

    UNION ALL

    SELECT a.created_at,
      CASE a.activity_type
        WHEN 'writing' THEN 'Writing session'
        WHEN 'listening' THEN 'Listening session'
        ELSE 'Speaking session'
      END,
      20
    FROM activities a CROSS JOIN bounds b
    WHERE a.user_id = b.user_id
      AND a.activity_type IN ('writing', 'listening', 'conversation')
      AND a.created_at >= b.from_ts AND a.created_at < b.to_ts

    UNION ALL

    SELECT uv.last_reviewed_at, 'Word reviewed', 2
    FROM user_vocabulary uv CROSS JOIN bounds b
    WHERE uv.user_id = b.user_id
      AND uv.last_reviewed_at >= b.from_ts AND uv.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT le.last_reviewed_at, 'Mistake reviewed', 5
    FROM learning_errors le CROSS JOIN bounds b
    WHERE le.user_id = b.user_id
      AND le.last_reviewed_at >= b.from_ts AND le.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT v.created_at, 'Extra video watched: ' || coalesce(p.title, 'Extra video'), 5
    FROM premium_video_views v
    JOIN premium_level_videos p ON p.id = v.video_id
    CROSS JOIN bounds b
    WHERE v.user_id = b.user_id AND p.kind = 'video'
      AND v.created_at >= b.from_ts AND v.created_at < b.to_ts

    UNION ALL

    SELECT award.awarded_at, 'English Adventure', award.xp
    FROM english_adventure_xp_awards award CROSS JOIN bounds b
    WHERE award.user_id = b.user_id
      AND award.awarded_at >= b.from_ts AND award.awarded_at < b.to_ts

    UNION ALL

    SELECT (daily.day::timestamp AT TIME ZONE 'America/Sao_Paulo'),
           'Daily goal met',
           30
    FROM bounds b
    CROSS JOIN LATERAL generate_series(
      b.week_start::timestamp,
      (b.week_start + 6)::timestamp,
      interval '1 day'
    ) AS daily(day)
    WHERE
      (SELECT count(*) FROM activities a
       WHERE a.user_id = b.user_id AND a.activity_type = 'writing'
         AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = daily.day::date) >= 3
      OR (SELECT count(*) FROM activities a
          WHERE a.user_id = b.user_id AND a.activity_type = 'listening'
            AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = daily.day::date) >= 3
      OR (SELECT count(*) FROM user_vocabulary uv
          WHERE uv.user_id = b.user_id
            AND (uv.last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = daily.day::date) >= 10
      OR EXISTS (SELECT 1 FROM user_lessons ul
                 WHERE ul.user_id = b.user_id
                   AND (ul.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = daily.day::date)
  )
  SELECT entries.occurred_at, entries.activity, entries.xp
  FROM entries
  ORDER BY entries.occurred_at DESC;
$$;

REVOKE ALL ON FUNCTION public.weekly_league_xp_breakdown() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_league_xp_breakdown() TO authenticated;

NOTIFY pgrst, 'reload schema';
