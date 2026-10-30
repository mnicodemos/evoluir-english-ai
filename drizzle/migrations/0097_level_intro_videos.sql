-- Level presentation videos (owner request, 2026-10-31): one Vimeo video per
-- level (A1 to C2) and one for Business English, shown on top of the learning
-- path ("Start here") and of /business. Set by the owner in Admin → Content;
-- only the server writes (service role, admin checked through has_role);
-- signed-in students read them. Idempotent.

CREATE TABLE IF NOT EXISTS public.level_intro_videos (
  level text PRIMARY KEY CHECK (level IN ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'business')),
  video_url text NOT NULL CHECK (video_url ~ '^https://vimeo\.com/[0-9]+'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.level_intro_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.level_intro_videos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.level_intro_videos TO authenticated;
GRANT ALL ON public.level_intro_videos TO service_role;

DROP POLICY IF EXISTS "Signed-in students read level intro videos" ON public.level_intro_videos;
CREATE POLICY "Signed-in students read level intro videos"
  ON public.level_intro_videos FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
