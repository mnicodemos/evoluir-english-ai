-- Configurable background opacity for Premium Short WebVTT captions.
-- 0 = fully transparent; 100 = fully opaque. Existing captions remain opaque.
ALTER TABLE public.premium_video_captions
  ADD COLUMN IF NOT EXISTS background_opacity integer NOT NULL DEFAULT 100
  CHECK (background_opacity BETWEEN 0 AND 100);
