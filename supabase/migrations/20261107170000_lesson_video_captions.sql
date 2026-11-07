-- Owner-managed WebVTT tracks for custom lesson captions in A1, A2 and B1.
CREATE TABLE IF NOT EXISTS public.lesson_video_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_key text NOT NULL,
  language text NOT NULL CHECK (language IN ('en', 'pt')),
  vtt_content text NOT NULL CHECK (char_length(vtt_content) BETWEEN 20 AND 500000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curriculum_key, language),
  CHECK (vtt_content LIKE 'WEBVTT%')
);

ALTER TABLE public.lesson_video_captions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_video_captions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lesson_video_captions TO service_role;

COMMENT ON TABLE public.lesson_video_captions IS
  'Admin-managed WebVTT caption tracks rendered by the Evoluir+ custom Vimeo lesson player.';
