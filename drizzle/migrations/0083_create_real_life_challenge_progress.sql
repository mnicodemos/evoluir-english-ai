CREATE TABLE IF NOT EXISTS public.real_life_challenge_progress (
  user_id uuid NOT NULL,
  lesson_key text NOT NULL CHECK (char_length(lesson_key) <= 64),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_key)
);
GRANT SELECT, INSERT, UPDATE ON public.real_life_challenge_progress TO authenticated;
GRANT ALL ON public.real_life_challenge_progress TO service_role;
ALTER TABLE public.real_life_challenge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own challenge progress read" ON public.real_life_challenge_progress;
CREATE POLICY "Own challenge progress read" ON public.real_life_challenge_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own challenge progress insert" ON public.real_life_challenge_progress;
CREATE POLICY "Own challenge progress insert" ON public.real_life_challenge_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own challenge progress update" ON public.real_life_challenge_progress;
CREATE POLICY "Own challenge progress update" ON public.real_life_challenge_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
NOTIFY pgrst, 'reload schema';