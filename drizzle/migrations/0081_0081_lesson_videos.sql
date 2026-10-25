-- Approved lesson videos (owner request, 2026-10-25: lesson videos must match
-- the lesson's topic and level). One video per curriculum lesson, chosen by
-- the owner in Admin → Vídeos; every student of that lesson then sees it.
-- Only the server writes (service role, admin checked through has_role);
-- nobody else reads the table directly. Idempotent.

CREATE TABLE IF NOT EXISTS public.lesson_videos (
  curriculum_key text PRIMARY KEY CHECK (char_length(curriculum_key) BETWEEN 3 AND 40),
  video_url text NOT NULL CHECK (video_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'),
  video_seconds integer CHECK (video_seconds IS NULL OR video_seconds BETWEEN 1 AND 7200),
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lesson_videos FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.lesson_videos TO service_role;

NOTIFY pgrst, 'reload schema';