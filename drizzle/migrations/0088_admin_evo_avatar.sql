-- Add Admin-managed shared EVO avatar without changing dashboard image settings.
BEGIN;

ALTER TABLE public.home_media_settings
  DROP CONSTRAINT IF EXISTS home_media_settings_setting_key_check;

ALTER TABLE public.home_media_settings
  ADD CONSTRAINT home_media_settings_setting_key_check
  CHECK (setting_key IN ('desktop', 'mobile', 'evo-avatar'));

-- The existing dashboard-home-images bucket already accepts JPG, PNG and WebP
-- up to 3 MB. The avatar is stored under its own path in that same bucket.
NOTIFY pgrst, 'reload schema';

COMMIT;
