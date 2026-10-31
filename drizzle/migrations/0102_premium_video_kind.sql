-- Shorts tab on the extra videos page (owner request, 2026-10-31): each
-- Premium extra video is either a regular video or a short (vertical, shown
-- 9:16 under its own "Shorts" tab). Existing rows stay regular videos.
-- Shorts may also be Instagram Reels (owner request, 2026-10-31), so the link
-- check from 0101 (Vimeo only) becomes: Vimeo for any video, an Instagram Reel
-- link only for a short.
-- Idempotent: safe to run again.

ALTER TABLE public.premium_level_videos
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'premium_level_videos_kind_check'
      AND conrelid = 'public.premium_level_videos'::regclass
  ) THEN
    ALTER TABLE public.premium_level_videos
      ADD CONSTRAINT premium_level_videos_kind_check CHECK (kind IN ('video', 'short'));
  END IF;
END $$;

-- Every check on the link, whatever its name (0101's was named by Postgres).
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.premium_level_videos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%video_url%'
  LOOP
    EXECUTE format('ALTER TABLE public.premium_level_videos DROP CONSTRAINT %I', item.conname);
  END LOOP;
END $$;
ALTER TABLE public.premium_level_videos
  ADD CONSTRAINT premium_level_videos_url_check CHECK (
    video_url ~ '^https://vimeo\.com/[0-9]+'
    OR (kind = 'short' AND video_url ~ '^https://www\.instagram\.com/reel/[A-Za-z0-9_-]+/$')
  );

NOTIFY pgrst, 'reload schema';
