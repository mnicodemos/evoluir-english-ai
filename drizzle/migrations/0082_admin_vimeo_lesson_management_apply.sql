-- Move lesson video management to Vimeo links entered by an administrator.
-- Preserve the six Vimeo reinforcements that were previously hard-coded in Summary.
-- Legacy YouTube rows are cleared because the product is moving to Vimeo.

ALTER TABLE public.lesson_videos
  DROP CONSTRAINT IF EXISTS lesson_videos_video_url_check;

DELETE FROM public.lesson_videos
WHERE video_url !~ '^https://vimeo[.]com/[0-9]+$';

UPDATE public.lessons
SET video_url = NULL,
    video_duration_seconds = 0
WHERE video_url ~* '^https://(www[.]youtube[.]com|youtu[.]be)/';

ALTER TABLE public.lesson_videos
  ADD CONSTRAINT lesson_videos_video_url_vimeo_check
  CHECK (video_url ~ '^https://vimeo[.]com/[0-9]+$');

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

UPDATE public.lessons AS l
SET video_url = v.video_url,
    video_duration_seconds = COALESCE(v.video_seconds, 0)
FROM public.lesson_videos AS v
WHERE l.curriculum_key = v.curriculum_key;

NOTIFY pgrst, 'reload schema';
