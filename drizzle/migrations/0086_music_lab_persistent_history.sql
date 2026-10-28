-- Persist generated Music Lab lyrics and audio without storing large base64 payloads in Postgres.
BEGIN;

CREATE TABLE IF NOT EXISTS public.music_lab_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 2 AND 80),
  genre text NOT NULL CHECK (genre IN ('pop', 'acoustic', 'indie', 'R&B', 'rock', 'reggae', 'lofi')),
  goal text NOT NULL CHECK (
    goal IN (
      'everyday vocabulary',
      'pronunciation and rhythm',
      'phrasal verbs and expressions',
      'grammar in context'
    )
  ),
  lyrics text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/mpeg',
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_lab_songs_user_created_at_idx
  ON public.music_lab_songs (user_id, created_at DESC);

ALTER TABLE public.music_lab_songs ENABLE ROW LEVEL SECURITY;

-- Access is intentionally server-only: API routes authenticate the owner and use the service role.
REVOKE ALL ON TABLE public.music_lab_songs FROM anon, authenticated;
GRANT ALL ON TABLE public.music_lab_songs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('music-lab-audio', 'music-lab-audio', false, 26214400, NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = NULL;

COMMENT ON TABLE public.music_lab_songs IS
  'Private Music Lab history. Audio objects are stored in the private music-lab-audio bucket; access is mediated by authenticated server routes.';

COMMIT;
