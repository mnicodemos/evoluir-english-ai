-- Cross-device Focus timer state and session history.
-- Focus remains separate from pedagogical activities, study minutes and XP.

CREATE TABLE IF NOT EXISTS public.focus_timer_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state) = 'object'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.focus_session_logs (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_key text NOT NULL CHECK (length(session_key) BETWEEN 1 AND 100),
  day date NOT NULL,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  partial boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz NOT NULL,
  preset text NOT NULL CHECK (preset IN ('classic', 'short', 'deep')),
  task_id uuid,
  activity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_key)
);

CREATE INDEX IF NOT EXISTS focus_session_logs_user_day_idx
  ON public.focus_session_logs (user_id, day DESC);

ALTER TABLE public.focus_timer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_session_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.focus_timer_state, public.focus_session_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.focus_timer_state, public.focus_session_logs TO service_role;

CREATE OR REPLACE FUNCTION public.save_focus_timer_state(
  p_user_id uuid,
  p_state jsonb,
  p_expected_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.focus_timer_state;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_state) <> 'object'
     OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Invalid Focus timer state';
  END IF;

  SELECT * INTO v_current
  FROM public.focus_timer_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RETURN jsonb_build_object('saved', false, 'revision', 0, 'state', '{}'::jsonb);
    END IF;
    INSERT INTO public.focus_timer_state(user_id, state, revision, updated_at)
    VALUES (p_user_id, p_state, 1, now())
    RETURNING * INTO v_current;
    RETURN jsonb_build_object('saved', true, 'revision', v_current.revision, 'state', v_current.state);
  END IF;

  IF v_current.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('saved', false, 'revision', v_current.revision, 'state', v_current.state);
  END IF;

  UPDATE public.focus_timer_state
  SET state = p_state, revision = revision + 1, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_current;

  RETURN jsonb_build_object('saved', true, 'revision', v_current.revision, 'state', v_current.state);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_focus_session_logs(p_user_id uuid, p_sessions jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session jsonb;
  v_inserted integer := 0;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_sessions) <> 'array'
     OR jsonb_array_length(p_sessions) > 100 THEN
    RAISE EXCEPTION 'Invalid Focus session log batch';
  END IF;

  FOR v_session IN SELECT value FROM jsonb_array_elements(p_sessions)
  LOOP
    INSERT INTO public.focus_session_logs (
      user_id, session_key, day, minutes, partial, started_at, ended_at, preset, task_id, activity
    )
    VALUES (
      p_user_id,
      v_session->>'key',
      (v_session->>'day')::date,
      (v_session->>'minutes')::integer,
      COALESCE((v_session->>'partial')::boolean, false),
      NULLIF(v_session->>'startedAt', '')::timestamptz,
      (v_session->>'endedAt')::timestamptz,
      v_session->>'preset',
      NULLIF(v_session->>'taskId', '')::uuid,
      NULLIF(v_session->>'activity', '')
    )
    ON CONFLICT (user_id, session_key) DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.save_focus_timer_state(uuid, jsonb, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_focus_session_logs(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_focus_timer_state(uuid, jsonb, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_focus_session_logs(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
