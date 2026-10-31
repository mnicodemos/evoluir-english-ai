-- Extra videos watched, recorded on the server (owner request, 2026-10-31:
-- "watched today" lived only on the device, so the Quick Win came back on the
-- student's other phone or computer, and the Admin could not see which videos
-- students watch). One row per student, video and São Paulo day; the server
-- writes it when a Premium student plays a video or a short
-- (recordVideoView in src/lib/premiumVideoSocial.functions.ts). Students never
-- read or write it directly. Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.premium_video_views (
  video_id uuid NOT NULL REFERENCES public.premium_level_videos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id, day)
);

CREATE INDEX IF NOT EXISTS premium_video_views_user_day_idx
  ON public.premium_video_views (user_id, day);
CREATE INDEX IF NOT EXISTS premium_video_views_created_idx
  ON public.premium_video_views (created_at);

ALTER TABLE public.premium_video_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_video_views FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premium_video_views TO service_role;

NOTIFY pgrst, 'reload schema';
