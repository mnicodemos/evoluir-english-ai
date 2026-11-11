-- Make the XP detail ledger use the exact same sources and weights as
-- public.league_week_xp (migration 0075). Do not independently reconstruct
-- the daily-goal rule: credit_study_day records the authoritative award in
-- public.study_days, and league_week_xp counts those rows.
-- The caller identity and week are derived server-side.
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
    SELECT user_id,
           week_start,
           week_start::timestamp AT TIME ZONE 'America/Sao_Paulo' AS from_ts,
           (week_start + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo' AS to_ts
    FROM caller
    WHERE user_id IS NOT NULL
  ),
  entries AS (
    SELECT ul.completed_at AS occurred_at,
           'Lesson completed'::text AS activity,
           50::integer AS xp
    FROM public.user_lessons ul
    CROSS JOIN bounds b
    WHERE ul.user_id = b.user_id
      AND ul.completed_at >= b.from_ts
      AND ul.completed_at < b.to_ts

    UNION ALL

    SELECT a.created_at,
           CASE a.activity_type
             WHEN 'writing' THEN 'Writing session'
             WHEN 'listening' THEN 'Listening session'
             WHEN 'daily_reading' THEN 'Daily reading'
             ELSE 'Speaking session'
           END::text,
           20::integer
    FROM public.activities a
    CROSS JOIN bounds b
    WHERE a.user_id = b.user_id
      AND a.activity_type IN ('writing', 'listening', 'conversation', 'daily_reading')
      AND a.created_at >= b.from_ts
      AND a.created_at < b.to_ts

    UNION ALL

    SELECT uv.last_reviewed_at,
           'Word reviewed'::text,
           2::integer
    FROM public.user_vocabulary uv
    CROSS JOIN bounds b
    WHERE uv.user_id = b.user_id
      AND uv.last_reviewed_at >= b.from_ts
      AND uv.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT le.last_reviewed_at,
           'Mistake reviewed'::text,
           5::integer
    FROM public.learning_errors le
    CROSS JOIN bounds b
    WHERE le.user_id = b.user_id
      AND le.last_reviewed_at >= b.from_ts
      AND le.last_reviewed_at < b.to_ts

    UNION ALL

    SELECT sd.day::timestamp AT TIME ZONE 'America/Sao_Paulo',
           'Daily study goal'::text,
           30::integer
    FROM public.study_days sd
    CROSS JOIN bounds b
    WHERE sd.user_id = b.user_id
      AND sd.day >= b.week_start
      AND sd.day < b.week_start + 7
  )
  SELECT e.occurred_at, e.activity, e.xp
  FROM entries e
  ORDER BY e.occurred_at DESC;
$$;

REVOKE ALL ON FUNCTION public.weekly_league_xp_breakdown() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_league_xp_breakdown() TO authenticated;

NOTIFY pgrst, 'reload schema';
