ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS operation_key uuid,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS operation_status text,
  ADD COLUMN IF NOT EXISTS result jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS activities_user_source_operation_uidx
ON public.activities (user_id, source_type, operation_key)
WHERE operation_key IS NOT NULL AND source_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.persist_authoritative_legacy_activity(
  p_user_id uuid,
  p_source_type text,
  p_operation_key uuid,
  p_source_id uuid,
  p_activity_type text,
  p_title text,
  p_duration_minutes integer,
  p_score integer,
  p_scores jsonb,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_existing public.activities%ROWTYPE;
  v_previous public.progress%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_yesterday date := v_today - 1;
  v_streak integer;
BEGIN
  IF p_user_id IS NULL OR p_operation_key IS NULL
    OR p_source_type NOT IN ('quiz','writing','listening','pronunciation','talking','telemetry')
    OR p_duration_minutes < 0 OR p_duration_minutes > 1440
    OR p_score IS NOT NULL AND (p_score < 0 OR p_score > 100)
    OR jsonb_typeof(COALESCE(p_scores, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_legacy_activity' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':legacy:' || p_source_type || ':' || p_operation_key::text));

  SELECT * INTO v_existing
  FROM public.activities
  WHERE user_id = p_user_id AND source_type = p_source_type AND operation_key = p_operation_key;

  IF FOUND THEN
    IF v_existing.activity_type IS DISTINCT FROM p_activity_type
      OR v_existing.source_id IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'legacy_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('duplicate', true, 'activity_id', v_existing.id, 'score', v_existing.score, 'result', v_existing.result);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.activities (
    user_id, activity_type, title, duration_minutes, score, level,
    operation_key, source_type, source_id, operation_status, result
  ) VALUES (
    p_user_id, p_activity_type, left(p_title, 240), p_duration_minutes, p_score,
    v_profile.level, p_operation_key, p_source_type, p_source_id, 'completed', COALESCE(p_result, '{}'::jsonb)
  ) RETURNING * INTO v_existing;

  IF p_activity_type IN ('lesson','final_test','conversation') AND v_profile.last_activity_date IS DISTINCT FROM v_today THEN
    v_streak := CASE WHEN v_profile.last_activity_date = v_yesterday THEN v_profile.streak_days + 1 ELSE 1 END;
    UPDATE public.profiles SET streak_days = v_streak, last_activity_date = v_today WHERE id = p_user_id;
  END IF;

  IF p_scores <> '{}'::jsonb THEN
    SELECT * INTO v_previous
    FROM public.progress
    WHERE user_id = p_user_id AND level = v_profile.level
    ORDER BY recorded_at DESC
    LIMIT 1
    FOR UPDATE;

    INSERT INTO public.progress (
      user_id, level, speaking_score, reading_score, grammar_score,
      listening_score, vocabulary_score, writing_score
    ) VALUES (
      p_user_id,
      v_profile.level,
      GREATEST(COALESCE(v_previous.speaking_score, 0), COALESCE((p_scores->>'speaking')::integer, COALESCE(v_previous.speaking_score, 0))),
      GREATEST(COALESCE(v_previous.reading_score, 0), COALESCE((p_scores->>'reading')::integer, COALESCE(v_previous.reading_score, 0))),
      GREATEST(COALESCE(v_previous.grammar_score, 0), COALESCE((p_scores->>'grammar')::integer, COALESCE(v_previous.grammar_score, 0))),
      GREATEST(COALESCE(v_previous.listening_score, 0), COALESCE((p_scores->>'listening')::integer, COALESCE(v_previous.listening_score, 0))),
      GREATEST(COALESCE(v_previous.vocabulary_score, 0), COALESCE((p_scores->>'vocabulary')::integer, COALESCE(v_previous.vocabulary_score, 0))),
      GREATEST(COALESCE(v_previous.writing_score, 0), COALESCE((p_scores->>'writing')::integer, COALESCE(v_previous.writing_score, 0)))
    );
  END IF;

  RETURN jsonb_build_object('duplicate', false, 'activity_id', v_existing.id, 'score', v_existing.score, 'result', v_existing.result);
END;
$$;

REVOKE ALL ON FUNCTION public.persist_authoritative_legacy_activity(uuid, text, uuid, uuid, text, text, integer, integer, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_authoritative_legacy_activity(uuid, text, uuid, uuid, text, text, integer, integer, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.persist_authoritative_legacy_activity(uuid, text, uuid, uuid, text, text, integer, integer, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_authoritative_legacy_activity(uuid, text, uuid, uuid, text, text, integer, integer, jsonb, jsonb) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.activities FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.activities TO authenticated;
GRANT SELECT ON TABLE public.progress TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;
GRANT ALL ON TABLE public.progress TO service_role;

DROP POLICY IF EXISTS "own activities" ON public.activities;
DROP POLICY IF EXISTS "own" ON public.activities;
CREATE POLICY "Users can view own activities"
ON public.activities FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own progress" ON public.progress;
DROP POLICY IF EXISTS "own" ON public.progress;
CREATE POLICY "Users can view own progress"
ON public.progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
