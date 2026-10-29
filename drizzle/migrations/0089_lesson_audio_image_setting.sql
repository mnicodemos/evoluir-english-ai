-- Allow the separately managed Lesson Audio image in the existing settings table.
BEGIN;

ALTER TABLE public.home_media_settings
  DROP CONSTRAINT IF EXISTS home_media_settings_setting_key_check;

ALTER TABLE public.home_media_settings
  ADD CONSTRAINT home_media_settings_setting_key_check
  CHECK (setting_key IN ('desktop', 'mobile', 'evo-avatar', 'lesson-audio'));

NOTIFY pgrst, 'reload schema';
COMMIT;
