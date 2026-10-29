-- Add an independently managed image for the AI Video Call stage.
-- Preserve all existing dashboard, EVO avatar, and Lesson Audio media keys.
BEGIN;

ALTER TABLE public.home_media_settings
  DROP CONSTRAINT IF EXISTS home_media_settings_setting_key_check;

ALTER TABLE public.home_media_settings
  ADD CONSTRAINT home_media_settings_setting_key_check
  CHECK (setting_key IN ('desktop', 'mobile', 'evo-avatar', 'lesson-audio', 'video-call'));

NOTIFY pgrst, 'reload schema';

COMMIT;
