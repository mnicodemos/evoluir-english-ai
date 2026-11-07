-- Per-Short WebVTT captions, independent of lesson caption tracks.
CREATE TABLE IF NOT EXISTS public.premium_video_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.premium_level_videos(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('en', 'pt')),
  vtt_content text NOT NULL CHECK (char_length(vtt_content) BETWEEN 20 AND 500000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, language),
  CHECK (vtt_content LIKE 'WEBVTT%')
);
ALTER TABLE public.premium_video_captions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_video_captions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premium_video_captions TO service_role;
COMMENT ON TABLE public.premium_video_captions IS 'Admin-managed WebVTT captions attached to an individual Premium Short.';
