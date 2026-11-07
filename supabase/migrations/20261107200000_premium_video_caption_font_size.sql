-- Per-Short caption display size, shared by its language tracks.
ALTER TABLE public.premium_video_captions
  ADD COLUMN IF NOT EXISTS font_size smallint NOT NULL DEFAULT 20
  CHECK (font_size IN (16, 20, 24));
