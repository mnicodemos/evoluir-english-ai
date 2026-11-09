CREATE TABLE IF NOT EXISTS public.listening_sentence_checkpoints (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_key uuid NOT NULL,
  track_id text NOT NULL CHECK (track_id IN ('everyday','professional','travel')),
  round integer NOT NULL CHECK (round >= 0),
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes BETWEEN 0 AND 1440),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listening_sentence_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own Listening checkpoints" ON public.listening_sentence_checkpoints;
CREATE POLICY "Users can view own Listening checkpoints"
ON public.listening_sentence_checkpoints FOR SELECT TO authenticated
USING (auth.uid() = user_id);
REVOKE ALL ON public.listening_sentence_checkpoints FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.listening_sentence_checkpoints TO authenticated;
GRANT ALL ON public.listening_sentence_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.save_listening_checkpoint(
  p_user_id uuid, p_operation_key uuid, p_track_id text, p_round integer,
  p_duration_minutes integer, p_result jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_operation_key IS NULL
    OR p_track_id NOT IN ('everyday','professional','travel')
    OR p_round < 0 OR p_duration_minutes < 0 OR p_duration_minutes > 1440
    OR jsonb_typeof(COALESCE(p_result, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(p_result->'sessionSentences') <> 'array'
    OR jsonb_array_length(p_result->'sessionSentences') <> 9
    OR jsonb_typeof(p_result->'evidence') <> 'array'
    OR jsonb_array_length(p_result->'evidence') NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_listening_checkpoint' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':listening-checkpoint'));
  INSERT INTO public.listening_sentence_checkpoints
    (user_id, operation_key, track_id, round, duration_minutes, result, updated_at)
  VALUES (p_user_id, p_operation_key, p_track_id, p_round, p_duration_minutes, p_result, now())
  ON CONFLICT (user_id) DO UPDATE SET
    operation_key = EXCLUDED.operation_key, track_id = EXCLUDED.track_id,
    round = EXCLUDED.round, duration_minutes = EXCLUDED.duration_minutes,
    result = EXCLUDED.result, updated_at = now();
  RETURN jsonb_build_object('saved', true, 'operation_key', p_operation_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_listening_checkpoint(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object('operation_key', operation_key, 'result', result)
  FROM public.listening_sentence_checkpoints WHERE user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION public.clear_listening_checkpoint(p_user_id uuid, p_operation_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.listening_sentence_checkpoints
  WHERE user_id = p_user_id AND operation_key = p_operation_key;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.save_listening_checkpoint(uuid, uuid, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_listening_checkpoint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_listening_checkpoint(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_listening_checkpoint(uuid, uuid, text, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_listening_checkpoint(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_listening_checkpoint(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
