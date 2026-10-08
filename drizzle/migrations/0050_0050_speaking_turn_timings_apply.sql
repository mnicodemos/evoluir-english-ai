CREATE TABLE IF NOT EXISTS public.speaking_turn_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  transcribe_ms integer CHECK (transcribe_ms BETWEEN 0 AND 120000),
  first_text_ms integer CHECK (first_text_ms BETWEEN 0 AND 120000),
  first_audio_ms integer CHECK (first_audio_ms BETWEEN 0 AND 120000)
);
CREATE INDEX IF NOT EXISTS speaking_turn_timings_created_at_idx
  ON public.speaking_turn_timings (created_at DESC);
ALTER TABLE public.speaking_turn_timings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.speaking_turn_timings FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.speaking_turn_timings TO authenticated;
GRANT ALL ON public.speaking_turn_timings TO service_role;
DROP POLICY IF EXISTS "Students record their own speaking timings" ON public.speaking_turn_timings;
CREATE POLICY "Students record their own speaking timings"
  ON public.speaking_turn_timings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
NOTIFY pgrst, 'reload schema';