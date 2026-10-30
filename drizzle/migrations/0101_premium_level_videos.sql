-- Premium extra videos by level (owner decision, 2026-10-31: not tied to a
-- unit or lesson, only to a level): any number of Vimeo videos per level, each
-- with its own title, shown to Premium students on /learning/videos. Replaces
-- premium_lesson_videos (migration 0100, one video per lesson); the videos
-- already saved there are copied here once with the lesson's key as title
-- placeholder only when they had no title. Students never read the table: the
-- server checks Premium and hands out the links. Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.premium_level_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('a1', 'a2', 'b1', 'b2', 'c1', 'c2')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  video_url text NOT NULL CHECK (video_url ~ '^https://vimeo\.com/[0-9]+'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_level_videos_level_url_unique UNIQUE (level, video_url)
);

ALTER TABLE public.premium_level_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_level_videos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premium_level_videos TO service_role;

DO $$
BEGIN
  IF to_regclass('public.premium_lesson_videos') IS NOT NULL THEN
    INSERT INTO public.premium_level_videos (level, title, video_url, created_at)
    SELECT split_part(curriculum_key, '-', 1),
           COALESCE(NULLIF(btrim(title), ''), curriculum_key),
           video_url,
           updated_at
    FROM public.premium_lesson_videos
    ON CONFLICT (level, video_url) DO NOTHING;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
