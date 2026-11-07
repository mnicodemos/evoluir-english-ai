-- Editable Premium extra videos and explicit display order for Shorts and Extra Videos.
ALTER TABLE public.premium_level_videos
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY kind ORDER BY created_at ASC, id ASC
  ) AS position
  FROM public.premium_level_videos
)
UPDATE public.premium_level_videos AS videos
SET sort_order = ranked.position
FROM ranked
WHERE videos.id = ranked.id AND videos.sort_order = 0;

NOTIFY pgrst, 'reload schema';
