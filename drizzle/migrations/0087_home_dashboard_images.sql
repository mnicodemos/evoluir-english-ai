-- Persist independently managed desktop and mobile dashboard images.
BEGIN;
CREATE TABLE IF NOT EXISTS public.home_media_settings (
 setting_key text PRIMARY KEY CHECK (setting_key IN ('desktop','mobile')),
 image_url text NOT NULL CHECK (char_length(image_url) BETWEEN 1 AND 2048),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.home_media_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.home_media_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.home_media_settings TO service_role;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('dashboard-home-images','dashboard-home-images',true,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, public=true, file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;
-- No client write policies: server functions authorize admin uploads and settings changes.
NOTIFY pgrst, 'reload schema';
COMMIT;
