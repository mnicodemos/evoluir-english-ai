-- Durable, merge-safe progress for the four English Adventures.
-- Apply through the Lovable Cloud database migration workflow after reviewing this file.

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
  PRIMARY KEY (user_id, adventure_id),
  CHECK (
    completed_activity_ids <@ ARRAY[
      adventure_id || ':0', adventure_id || ':1', adventure_id || ':2',
      adventure_id || ':3', adventure_id || ':4', adventure_id || ':5',
      adventure_id || ':6', adventure_id || ':7', adventure_id || ':8',
      adventure_id || ':9'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS english_adventure_checkpoints_user_updated_idx
  ON public.english_adventure_checkpoints (user_id, updated_at DESC);

ALTER TABLE public.english_adventure_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.english_adventure_checkpoints FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.english_adventure_checkpoints TO service_role;

DROP FUNCTION IF EXISTS public.save_english_adventure_checkpoint(uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer);

CREATE OR REPLACE FUNCTION public.save_english_adventure_checkpoint(
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
  v_checkpoint public.english_adventure_checkpoints;
BEGIN
  IF p_user_id IS NULL
    OR p_adventure_id NOT IN (
      'a1-welcome-mix-up',
      'a1-neighbourhood-mystery',
      'a2-surprise-delivery',
      'a2-community-festival'
    )
    OR p_current_step < 0 OR p_current_step > 10
    OR jsonb_typeof(p_choices) <> 'object'
    OR jsonb_typeof(p_decisions) <> 'array'
    OR p_recovered < 0
    OR p_expected_revision < 0
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_completed_activity_ids, '{}')) AS activities(activity_id)
      WHERE activity_id !~ ('^' || p_adventure_id || ':[0-9]$')
    )
  THEN
    RAISE EXCEPTION 'Invalid English Adventure checkpoint';
  END IF;

  INSERT INTO public.english_adventure_checkpoints AS existing (
    user_id, adventure_id, current_step, choices, decisions,
    recovered, completed_activity_ids, completed, revision, updated_at
  )
  VALUES (
    p_user_id, p_adventure_id, p_current_step, p_choices, p_decisions,
    p_recovered, COALESCE(p_completed_activity_ids, '{}'), p_completed, 1, now()
  )
  ON CONFLICT (user_id, adventure_id) DO UPDATE
  SET current_step = CASE WHEN p_restart THEN EXCLUDED.current_step ELSE GREATEST(existing.current_step, EXCLUDED.current_step) END,
      choices = CASE WHEN p_restart THEN EXCLUDED.choices ELSE existing.choices || EXCLUDED.choices END,
      decisions = CASE
        WHEN p_restart THEN EXCLUDED.decisions
        WHEN jsonb_array_length(EXCLUDED.decisions) >= jsonb_array_length(existing.decisions)
          THEN EXCLUDED.decisions
        ELSE existing.decisions
      END,
      recovered = GREATEST(existing.recovered, EXCLUDED.recovered),
      completed_activity_ids = ARRAY(
        SELECT DISTINCT activity_id
        FROM unnest(existing.completed_activity_ids || EXCLUDED.completed_activity_ids) AS activities(activity_id)
        ORDER BY activity_id
      ),
      completed = CASE WHEN p_restart THEN EXCLUDED.completed ELSE existing.completed OR EXCLUDED.completed END,
      revision = existing.revision + 1,
      updated_at = now()
  RETURNING * INTO v_checkpoint;

  RETURN jsonb_build_object(
    'saved', true,
    'merged', true,
    'checkpoint', to_jsonb(v_checkpoint)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer, boolean
) TO service_role;

NOTIFY pgrst, 'reload schema';
