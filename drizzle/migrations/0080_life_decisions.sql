-- Life+ AI Decisions (phase 2): a weighted decision matrix per student.
-- Students only read their own rows; every write goes through the server
-- (service role), which checks Premium. Idempotent.

CREATE TABLE IF NOT EXISTS public.life_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  context text NOT NULL DEFAULT '' CHECK (char_length(context) <= 600),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decided')),
  chosen_option_id text CHECK (char_length(chosen_option_id) <= 16),
  analysis text CHECK (char_length(analysis) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS life_decisions_user_idx
  ON public.life_decisions (user_id, updated_at DESC);

ALTER TABLE public.life_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.life_decisions TO authenticated;
GRANT ALL ON public.life_decisions TO service_role;

DROP POLICY IF EXISTS "Students read their own decisions" ON public.life_decisions;
CREATE POLICY "Students read their own decisions"
  ON public.life_decisions FOR SELECT TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';