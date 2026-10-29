-- Allow Admin Home to publish an independent AI Video Call image.
-- Preserve the existing dashboard, EVO avatar, and Lesson Audio settings.
BEGIN;

ALTER TABLE public.home_media_settings
  DROP CONSTRAINT IF EXISTS home_media_settings_setting_key_check;

ALTER TABLE public.home_media_settings
  ADD CONSTRAINT home_media_settings_setting_key_check
  CHECK (setting_key = ANY (ARRAY['desktop', 'mobile', 'evo-avatar', 'lesson-audio', 'video-call']::text[]));

NOTIFY pgrst, 'reload schema';

COMMIT;
