-- Allow the Lesson Audio image setting and restore its already-uploaded Storage object.
-- Lovable Cloud runs this migration against the app's configured backend.
DO $$
DECLARE
  existing_check text;
  storage_base text;
BEGIN
  SELECT c.conname
    INTO existing_check
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'home_media_settings'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%setting_key%'
    AND pg_get_constraintdef(c.oid) ILIKE '%desktop%'
    AND pg_get_constraintdef(c.oid) ILIKE '%evo-avatar%'
  LIMIT 1;

  IF existing_check IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.home_media_settings DROP CONSTRAINT %I', existing_check);
  END IF;

  ALTER TABLE public.home_media_settings
    ADD CONSTRAINT home_media_settings_setting_key_check
    CHECK (setting_key = ANY (ARRAY['desktop', 'mobile', 'evo-avatar', 'lesson-audio']::text[]));

  -- Reuse the configured public Storage host from existing dashboard image URLs.
  SELECT regexp_replace(image_url, '/storage/v1/object/public/.*$', '')
    INTO storage_base
  FROM public.home_media_settings
  WHERE setting_key IN ('desktop', 'mobile')
    AND image_url IS NOT NULL
    AND image_url LIKE '%/storage/v1/object/public/%'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF storage_base IS NOT NULL THEN
    INSERT INTO public.home_media_settings (setting_key, image_url, updated_at)
    VALUES (
      'lesson-audio',
      storage_base || '/storage/v1/object/public/dashboard-home-images/lesson-audio/1793236517432.jpg',
      now()
    )
    ON CONFLICT (setting_key) DO UPDATE
      SET image_url = EXCLUDED.image_url,
          updated_at = EXCLUDED.updated_at;
  END IF;
END $$;
