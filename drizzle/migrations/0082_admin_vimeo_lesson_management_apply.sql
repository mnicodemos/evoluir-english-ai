-- Restore the six Vimeo lesson videos that were previously embedded directly in Summary.
-- Store them as approved lesson links so both Summary and Admin read the same source.
-- Idempotent: safe to apply again without duplicating rows.

CREATE TABLE IF NOT EXISTS public.lesson_videos (
  curriculum_key text PRIMARY KEY CHECK (char_length(curriculum_key) BETWEEN 3 AND 40),
  video_url text NOT NULL,
  video_seconds integer CHECK (video_seconds IS NULL OR video_seconds BETWEEN 1 AND 7200),
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_videos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lesson_videos TO service_role;

-- Drop the YouTube-only check introduced by migration 0081 and accept canonical Vimeo URLs.
ALTER TABLE public.lesson_videos
  DROP CONSTRAINT IF EXISTS lesson_videos_video_url_check;
ALTER TABLE public.lesson_videos
  DROP CONSTRAINT IF EXISTS lesson_videos_video_url_vimeo_check;
ALTER TABLE public.lesson_videos
  ADD CONSTRAINT lesson_videos_video_url_vimeo_check
  CHECK (video_url ~ '^https://vimeo[.]com/[0-9]+([?]h=[A-Za-z0-9]+)?$');

INSERT INTO public.lesson_videos (curriculum_key, video_url, video_seconds, approved_by, approved_at)
VALUES
  ('b1-u2-l2', 'https://vimeo.com/1239699995', NULL, NULL, now()),
  ('b2-u1-l1', 'https://vimeo.com/1239966935', NULL, NULL, now()),
  ('b1-u1-l3', 'https://vimeo.com/1239888973', NULL, NULL, now()),
  ('b1-u1-l6', 'https://vimeo.com/1239865994', NULL, NULL, now()),
  ('a1-u1-l3', 'https://vimeo.com/1239904982', NULL, NULL, now()),
  ('biz-u1-l1', 'https://vimeo.com/1239925702', NULL, NULL, now())
ON CONFLICT (curriculum_key) DO UPDATE
SET video_url = EXCLUDED.video_url,
    video_seconds = EXCLUDED.video_seconds,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at;

-- Mirror the approved URL into lesson records so the student Summary and Audio tab can render it.
UPDATE public.lessons AS lesson
SET video_url = video.video_url,
    video_duration_seconds = COALESCE(video.video_seconds, 0)
FROM public.lesson_videos AS video
WHERE lesson.curriculum_key = video.curriculum_key;

NOTIFY pgrst, 'reload schema';
