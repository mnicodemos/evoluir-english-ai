-- Aggregate Shorts social counts in PostgreSQL instead of transferring raw rows.
-- Moderation rule: comments with three or more reports are not counted.
CREATE OR REPLACE FUNCTION public.load_premium_video_social_counts(
  p_video_ids uuid[],
  p_user_id uuid
)
RETURNS TABLE (
  video_id uuid,
  likes bigint,
  liked boolean,
  comments bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(COALESCE(p_video_ids, ARRAY[]::uuid[])) AS video_id
  ),
  like_counts AS (
    SELECT l.video_id,
           count(*)::bigint AS likes,
           bool_or(l.user_id = p_user_id) AS liked
    FROM public.premium_video_likes l
    JOIN requested r ON r.video_id = l.video_id
    GROUP BY l.video_id
  ),
  visible_comment_counts AS (
    SELECT c.video_id, count(*)::bigint AS comments
    FROM public.premium_video_comments c
    JOIN requested r ON r.video_id = c.video_id
    LEFT JOIN public.premium_video_comment_reports cr ON cr.comment_id = c.id
    GROUP BY c.id, c.video_id
    HAVING count(cr.user_id) < 3
  ),
  comment_totals AS (
    SELECT video_id, sum(comments)::bigint AS comments
    FROM visible_comment_counts
    GROUP BY video_id
  )
  SELECT r.video_id,
         COALESCE(l.likes, 0)::bigint,
         COALESCE(l.liked, false),
         COALESCE(c.comments, 0)::bigint
  FROM requested r
  LEFT JOIN like_counts l ON l.video_id = r.video_id
  LEFT JOIN comment_totals c ON c.video_id = r.video_id;
$$;

REVOKE ALL ON FUNCTION public.load_premium_video_social_counts(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_premium_video_social_counts(uuid[], uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
