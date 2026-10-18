-- Weekly league in line with the study day (user decision, 2026-10-17, audit
-- items 7 and 8):
--   * the 30 XP study-day bonus counts the days credit_study_day really
--     credited (study_days, migration 0063), so a day closed by a conversation,
--     every goal step or the daily reading earns it too (the old copy of the
--     rule here missed them);
--   * a finished daily reading ('daily_reading') earns 20 XP, like a text, a
--     Listening session or a conversation.
-- Same signature and grants as migration 0043. Idempotent.

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
  )
  SELECT (
    50 * (SELECT count(*) FROM user_lessons, bounds
          WHERE user_id = p_user_id AND completed_at >= from_ts AND completed_at < to_ts)
    + 20 * (SELECT count(*) FROM activities, bounds
          WHERE user_id = p_user_id AND activity_type IN ('writing', 'listening', 'conversation', 'daily_reading')
            AND created_at >= from_ts AND created_at < to_ts)
    + 2 * (SELECT count(*) FROM user_vocabulary, bounds
          WHERE user_id = p_user_id AND last_reviewed_at >= from_ts AND last_reviewed_at < to_ts)
    + 5 * (SELECT count(*) FROM learning_errors, bounds
          WHERE user_id = p_user_id AND last_reviewed_at >= from_ts AND last_reviewed_at < to_ts)
    + 30 * (SELECT count(*) FROM study_days
          WHERE user_id = p_user_id AND day >= p_week_start AND day < p_week_start + 7)
  )::integer;
$$;

REVOKE ALL ON FUNCTION public.league_week_xp(uuid, date) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
