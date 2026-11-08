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

ALTER TABLE public.english_adventure_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.english_adventure_checkpoints FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.english_adventure_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.save_english_adventure_checkpoint(
  p_user_id uuid,
  p_adventure_id text,
  p_current_step integer,
  p_choices jsonb,
  p_decisions jsonb,
  p_recovered integer,
  p_completed_activity_ids text[],
  p_completed boolean,
  p_expected_revision integer
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
  THEN
    RAISE EXCEPTION 'Invalid English Adventure checkpoint';
  END IF;

  IF p_expected_revision = 0 THEN
    INSERT INTO public.english_adventure_checkpoints (
      user_id, adventure_id, current_step, choices, decisions,
      recovered, completed_activity_ids, completed, revision, updated_at
    )
    VALUES (
      p_user_id, p_adventure_id, p_current_step, p_choices, p_decisions,
      p_recovered, COALESCE(p_completed_activity_ids, '{}'), p_completed, 1, now()
    )
    ON CONFLICT (user_id, adventure_id) DO NOTHING
    RETURNING * INTO v_checkpoint;

    IF FOUND THEN
      RETURN jsonb_build_object('saved', true, 'checkpoint', to_jsonb(v_checkpoint));
    END IF;
  END IF;

  UPDATE public.english_adventure_checkpoints
  SET current_step = p_current_step,
      choices = p_choices,
      decisions = p_decisions,
      recovered = p_recovered,
      completed_activity_ids = COALESCE(p_completed_activity_ids, '{}'),
      completed = p_completed,
      revision = revision + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND adventure_id = p_adventure_id
    AND revision = p_expected_revision
  RETURNING * INTO v_checkpoint;

  IF FOUND THEN
    RETURN jsonb_build_object('saved', true, 'checkpoint', to_jsonb(v_checkpoint));
  END IF;

  SELECT * INTO v_checkpoint
  FROM public.english_adventure_checkpoints
  WHERE user_id = p_user_id AND adventure_id = p_adventure_id;

  RETURN jsonb_build_object('saved', false, 'checkpoint', to_jsonb(v_checkpoint));
END;
$$;

REVOKE ALL ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_english_adventure_checkpoint(
  uuid, text, integer, jsonb, jsonb, integer, text[], boolean, integer
) TO service_role;

NOTIFY pgrst, 'reload schema';
