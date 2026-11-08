-- English Adventures checkpoints, REVISED (supersedes the unapplied
-- supabase/migrations/20261108110000_english_adventure_checkpoints.sql).
-- NOT APPLIED. Apply only after approval, through the Lovable chat.
--
-- Optimistic concurrency: a save lands only when p_expected_revision equals the
-- stored revision (0 = no row yet); otherwise nothing is written and the current
-- server checkpoint returns with conflict = true.
-- A restart resets the narrative and bumps the revision, so devices holding the
-- older revision can no longer write it back. Completed activity IDs are always
-- kept (union), never removed. Idempotent; deletes no data.

CREATE TABLE IF NOT EXISTS public.english_adventure_checkpoints (
  user_id uuid NOT NULL,
  adventure_id text NOT NULL CHECK (adventure_id IN (
    'a1-welcome-mix-up',
    'a1-neighbourhood-mystery',
    'a2-surprise-delivery',
    'a2-community-festival'
  )),
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 10),
  choices jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(choices) = 'object'),
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(decisions) = 'array'),
  recovered integer NOT NULL DEFAULT 0 CHECK (recovered >= 0),
  completed_activity_ids text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, adventure_id)
);

CREATE INDEX IF NOT EXISTS english_adventure_checkpoints_user_updated_idx
  ON public.english_adventure_checkpoints (user_id, updated_at DESC);

-- Service role only: reads and writes go through authenticated server
-- functions that pass the caller's own user id (context.userId).
REVOKE ALL ON public.english_adventure_checkpoints FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.english_adventure_checkpoints TO service_role;
ALTER TABLE public.english_adventure_checkpoints ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.save_english_adventure_checkpoint(uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer);
DROP FUNCTION IF EXISTS public.save_english_adventure_checkpoint(uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer, boolean);

CREATE FUNCTION public.save_english_adventure_checkpoint(
  p_user_id uuid,
  p_adventure_id text,
  p_current_step integer,
  p_choices jsonb,
  p_decisions jsonb,
  p_recovered integer,
  p_completed_activity_ids text[],
  p_completed boolean,
  p_expected_revision integer,
  p_restart boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.english_adventure_checkpoints;
  v_ids text[];
BEGIN
  IF p_user_id IS NULL
    OR p_adventure_id NOT IN (
      'a1-welcome-mix-up', 'a1-neighbourhood-mystery',
      'a2-surprise-delivery', 'a2-community-festival')
    OR p_current_step IS NULL OR p_current_step < 0 OR p_current_step > 10
    OR jsonb_typeof(p_choices) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_decisions) IS DISTINCT FROM 'array'
    OR p_recovered IS NULL OR p_recovered < 0
    OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_completed_activity_ids, '{}')) AS a(id)
      WHERE a.id !~ ('^' || p_adventure_id || ':[0-9]$'))
  THEN
    RAISE EXCEPTION 'invalid_english_adventure_checkpoint' USING ERRCODE = '22023';
  END IF;

  -- Serialise every save of this student's adventure, including the first insert.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':adventure:' || p_adventure_id));

  SELECT * INTO v_row FROM public.english_adventure_checkpoints
  WHERE user_id = p_user_id AND adventure_id = p_adventure_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RETURN jsonb_build_object('saved', false, 'conflict', true, 'checkpoint', NULL);
    END IF;
    INSERT INTO public.english_adventure_checkpoints (
      user_id, adventure_id, current_step, choices, decisions, recovered,
      completed_activity_ids, completed, revision, updated_at)
    VALUES (
      p_user_id, p_adventure_id, p_current_step, p_choices, p_decisions, p_recovered,
      ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_completed_activity_ids, '{}')) AS x ORDER BY x),
      p_completed AND NOT p_restart, 1, now())
    RETURNING * INTO v_row;
    RETURN jsonb_build_object('saved', true, 'conflict', false, 'checkpoint', to_jsonb(v_row));
  END IF;

  IF v_row.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('saved', false, 'conflict', true, 'checkpoint', to_jsonb(v_row));
  END IF;

  v_ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(v_row.completed_activity_ids || COALESCE(p_completed_activity_ids, '{}')) AS x
    ORDER BY x);

  UPDATE public.english_adventure_checkpoints
  SET current_step = p_current_step,
      choices = p_choices,
      decisions = p_decisions,
      recovered = p_recovered,
      completed_activity_ids = v_ids,
      completed = p_completed AND NOT p_restart,
      revision = v_row.revision + 1,
      updated_at = now()
  WHERE user_id = p_user_id AND adventure_id = p_adventure_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('saved', true, 'conflict', false, 'checkpoint', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer, boolean
) TO service_role;

NOTIFY pgrst, 'reload schema';
