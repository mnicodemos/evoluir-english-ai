-- Admin → Home images: the video call image could not be saved (owner report,
-- 2026-10-30). Two migrations numbered 0089 each rebuild the setting_key check
-- of home_media_settings, and the one applied last left 'video-call' out. This
-- drops every setting_key check, whatever its name, and adds the one list the
-- app uses. Idempotent: safe to apply again.
DO $$
DECLARE
  existing record;
BEGIN
  FOR existing IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'home_media_settings'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%setting_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.home_media_settings DROP CONSTRAINT %I', existing.conname);
  END LOOP;

  ALTER TABLE public.home_media_settings
    ADD CONSTRAINT home_media_settings_setting_key_check
    CHECK (setting_key IN ('desktop', 'mobile', 'evo-avatar', 'lesson-audio', 'video-call'));
END $$;

NOTIFY pgrst, 'reload schema';
