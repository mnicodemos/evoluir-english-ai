-- Life+ AI Focus (user decision, 2026-10-17: a Pomodoro-style timer, free,
-- with its history in the database): one row per finished focus block. The
-- timer itself runs in the browser; the server records a block once (the
-- operation key makes a repeated save harmless). Students only read their own
-- rows; writes go through the server (service role). Idempotent.

CREATE TABLE IF NOT EXISTS public.life_focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- São Paulo calendar day, like the study days.
  day date NOT NULL,
  focus_minutes integer NOT NULL CHECK (focus_minutes BETWEEN 1 AND 120),
  task_id uuid REFERENCES public.life_tasks (id) ON DELETE SET NULL,
  operation_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_key)
);
CREATE INDEX IF NOT EXISTS life_focus_sessions_user_day_idx
  ON public.life_focus_sessions (user_id, day);

ALTER TABLE public.life_focus_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_focus_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.life_focus_sessions TO authenticated;
GRANT ALL ON public.life_focus_sessions TO service_role;

DROP POLICY IF EXISTS "Students read their own focus sessions" ON public.life_focus_sessions;
CREATE POLICY "Students read their own focus sessions"
  ON public.life_focus_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
