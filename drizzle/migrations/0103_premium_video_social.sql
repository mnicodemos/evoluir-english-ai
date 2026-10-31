-- Likes and comments on the Premium extra videos (owner request, 2026-10-31:
-- the Shorts tab as an Instagram-like feed, with likes and comments).
-- Students never read or write these tables directly: every read and write
-- goes through the server (src/lib/premiumVideoSocial.functions.ts), which
-- checks Premium, keeps each comment to 1-500 characters without links,
-- limits how often a student comments and shows other students only by first
-- name and initial (author_name, stored when the comment is written).
-- Reports let students flag a comment; the owner sees them first in the Admin
-- and deletes what does not belong. Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.premium_video_likes (
  video_id uuid NOT NULL REFERENCES public.premium_level_videos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.premium_video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.premium_level_videos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS premium_video_comments_video_idx
  ON public.premium_video_comments (video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS premium_video_comments_user_idx
  ON public.premium_video_comments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.premium_video_comment_reports (
  comment_id uuid NOT NULL REFERENCES public.premium_video_comments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.premium_video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_video_comment_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.premium_video_likes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.premium_video_comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.premium_video_comment_reports FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.premium_video_likes TO service_role;
GRANT ALL ON public.premium_video_comments TO service_role;
GRANT ALL ON public.premium_video_comment_reports TO service_role;

NOTIFY pgrst, 'reload schema';
