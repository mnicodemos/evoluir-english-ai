-- Per-Short caption foreground and background colors, shared by English and Portuguese tracks.
ALTER TABLE public.premium_video_captions
  ADD COLUMN IF NOT EXISTS text_color text NOT NULL DEFAULT '#FFFFFF'
  CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE public.premium_video_captions
  ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#000000'
  CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$');
