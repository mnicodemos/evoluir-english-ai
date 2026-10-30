-- Premium extra videos (owner request, 2026-10-31): one Vimeo video per
-- curriculum lesson (key like "b1-u2-l3"), shown only to Premium students on
-- their own page (/learning/videos). Set by the owner in Admin → Content.
-- Students never read this table directly: the server checks Premium and
-- hands out the links, so a free account cannot read them. Idempotent.

CREATE TABLE IF NOT EXISTS public.premium_lesson_videos (
  curriculum_key text PRIMARY KEY CHECK (curriculum_key ~ '^(a1|a2|b1|b2|c1|c2)-u[1-6]-l[1-6]$'),
  video_url text NOT NULL CHECK (video_url ~ '^https://vimeo\.com/[0-9]+'),
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_lesson_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_lesson_videos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premium_lesson_videos TO service_role;

NOTIFY pgrst, 'reload schema';
