-- Reassert the extra-video Quick Win XP rule for environments where 0109
-- was present in source control but not applied to the active database.
-- CREATE OR REPLACE is safe to rerun and preserves the existing XP components.

-- Quick Win: award 5 weekly-league XP only after a regular extra video
-- reaches Vimeo's ended event and recordVideoView stores its server-side view.
-- premium_video_views has one row per student/video/Sao Paulo day, so retries,
-- repeated ended events, and refreshing the page cannot award duplicate XP.
-- Shorts are excluded; only kind='video' earns this Quick Win reward.

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
    + 5 * (SELECT count(*)
          FROM premium_video_views AS views
          JOIN premium_level_videos AS videos ON videos.id = views.video_id
          CROSS JOIN bounds
          WHERE views.user_id = p_user_id
            AND videos.kind = 'video'
            AND views.created_at >= from_ts
            AND views.created_at < to_ts)
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
