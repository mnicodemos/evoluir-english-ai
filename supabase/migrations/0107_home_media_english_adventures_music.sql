-- Allow one shared background-music setting for all English Adventures.
DO $$
DECLARE existing record;
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
    CHECK (setting_key IN (
      'desktop', 'mobile', 'evo-avatar', 'lesson-audio', 'video-call',
      'league', 'english-adventures-avatar', 'english-adventures-music'
    ));
END $$;

NOTIFY pgrst, 'reload schema';
