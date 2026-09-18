CREATE OR REPLACE FUNCTION public.persist_pedagogical_bundle(
  p_user_id uuid,
  p_session_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_rubric_version text,
  p_evidence jsonb,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.assessment_sessions%ROWTYPE;
  v_item jsonb;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_source_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'pedagogical_bundle_invalid_identity' USING ERRCODE = '22023';
  END IF;
  IF p_source_type NOT IN ('quiz', 'writing') THEN
    RAISE EXCEPTION 'pedagogical_bundle_invalid_source' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':pedagogy'));

  INSERT INTO public.assessment_sessions (
    id, user_id, assessment_type, status, ruleset_version, rubric_version,
    source_type, source_id, idempotency_key
  ) VALUES (
    p_session_id, p_user_id, 'progress_check', 'started', 'cefr-score-v1',
    p_rubric_version, p_source_type, p_source_id, p_idempotency_key
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_session
  FROM public.assessment_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_session.user_id IS DISTINCT FROM p_user_id
    OR v_session.source_type IS DISTINCT FROM p_source_type
    OR v_session.source_id IS DISTINCT FROM p_source_id
    OR v_session.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
    RAISE EXCEPTION 'pedagogical_idempotency_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('duplicate', true, 'evidence_count', 0);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_evidence)
  LOOP
    INSERT INTO public.assessment_evidence (
      id, assessment_session_id, user_id, skill, subskill, source_type,
      source_id, source_item_id, evidence_type, polarity, item_cefr,
      raw_score, source_reliability, evidence_quality, sample_weight,
      evaluated_by, model_version, rubric_version, metadata
    ) VALUES (
      (v_item->>'id')::uuid, p_session_id, p_user_id, v_item->>'skill',
      NULLIF(v_item->>'subskill', ''), p_source_type, p_source_id,
      NULLIF(v_item->>'source_item_id', '')::uuid, NULLIF(v_item->>'evidence_type', ''),
      NULLIF(v_item->>'polarity', ''), NULLIF(v_item->>'item_cefr', ''),
      (v_item->>'raw_score')::numeric, (v_item->>'source_reliability')::numeric,
      (v_item->>'evidence_quality')::numeric, (v_item->>'sample_weight')::numeric,
      v_item->>'evaluated_by', NULLIF(v_item->>'model_version', ''),
      v_item->>'rubric_version', COALESCE(v_item->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_results)
  LOOP
    INSERT INTO public.assessment_skill_results (
      id, assessment_session_id, user_id, skill, score, cefr_level,
      confidence_score, evidence_count, rule_version
    ) VALUES (
      (v_item->>'id')::uuid, p_session_id, p_user_id, v_item->>'skill',
      NULLIF(v_item->>'score', '')::numeric, v_item->>'cefr_level',
      NULLIF(v_item->>'confidence_score', '')::numeric,
      (v_item->>'evidence_count')::integer, v_item->>'rule_version'
    )
    ON CONFLICT (assessment_session_id, skill) DO NOTHING;
  END LOOP;

  UPDATE public.assessment_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = p_session_id AND status = 'started';

  RETURN jsonb_build_object('duplicate', false, 'evidence_count', jsonb_array_length(p_evidence));
END;
$$;

REVOKE ALL ON FUNCTION public.persist_pedagogical_bundle(uuid, uuid, text, uuid, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_pedagogical_bundle(uuid, uuid, text, uuid, text, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.persist_pedagogical_bundle(uuid, uuid, text, uuid, text, text, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_pedagogical_bundle(uuid, uuid, text, uuid, text, text, jsonb, jsonb) TO service_role;