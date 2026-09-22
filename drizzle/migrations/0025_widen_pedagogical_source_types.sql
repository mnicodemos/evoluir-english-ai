-- Phase 26: allow the existing pedagogical pipeline to accept evidence from the
-- activities that already produce structured, server-derived results
-- (Listening Lab, Speaking/Talking, Pronunciation). No new table, no new column,
-- no change to aggregation, CEFR, confidence or weights.

ALTER TABLE public.assessment_sessions
  DROP CONSTRAINT IF EXISTS assessment_sessions_source_type_check;
ALTER TABLE public.assessment_sessions
  ADD CONSTRAINT assessment_sessions_source_type_check
  CHECK (
    source_type IS NULL
    OR source_type = ANY (ARRAY['quiz','writing','teacher','listening','speaking','pronunciation'])
  );

ALTER TABLE public.pedagogical_dual_write_failures
  DROP CONSTRAINT IF EXISTS pedagogical_dual_write_failures_source_type_check;
ALTER TABLE public.pedagogical_dual_write_failures
  ADD CONSTRAINT pedagogical_dual_write_failures_source_type_check
  CHECK (source_type = ANY (ARRAY['quiz','writing','teacher','listening','speaking','pronunciation']));

CREATE OR REPLACE FUNCTION public.persist_pedagogical_bundle(p_user_id uuid, p_session_id uuid, p_source_type text, p_source_id uuid, p_idempotency_key text, p_rubric_version text, p_evidence jsonb, p_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.assessment_sessions%ROWTYPE;
  v_item jsonb;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_source_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'pedagogical_bundle_invalid_identity' USING ERRCODE = '22023';
  END IF;
  IF p_source_type NOT IN ('quiz', 'writing', 'teacher', 'listening', 'speaking', 'pronunciation') THEN
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
$function$;

-- The new sources are live activity results that the retry worker cannot replay
-- from persisted state, exactly like teacher turns: never queue them for retry.
CREATE OR REPLACE FUNCTION public.record_pedagogical_failure(p_user_id uuid, p_source_type text, p_source_id uuid, p_idempotency_key text, p_stage text, p_error_code text, p_error_message text, p_already_claimed boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.pedagogical_dual_write_failures%ROWTYPE;
  v_attempt_count integer;
  v_retryable boolean;
  v_delay_seconds integer;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid_failure_identity' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_idempotency_key));

  SELECT * INTO v_existing
  FROM public.pedagogical_dual_write_failures
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  v_attempt_count := CASE
    WHEN FOUND AND p_already_claimed THEN v_existing.attempt_count
    WHEN FOUND THEN LEAST(v_existing.attempt_count + 1, 5)
    ELSE 1
  END;
  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT','MISSING_PEDAGOGICAL_MAPPING')
    AND p_source_type IN ('quiz','writing');
  v_delay_seconds := LEAST(3600, (15 * power(2, LEAST(v_attempt_count - 1, 8)))::integer);

  INSERT INTO public.pedagogical_dual_write_failures (
    user_id, source_type, source_id, idempotency_key, stage, error_code,
    last_error_message, status, attempt_count, last_failed_at, next_retry_at,
    processing_started_at, completed_at, resolved_at
  ) VALUES (
    p_user_id, p_source_type, p_source_id, p_idempotency_key, p_stage, p_error_code,
    left(p_error_message, 240),
    CASE WHEN v_retryable AND v_attempt_count < 5 THEN 'pending' ELSE 'failed' END,
    v_attempt_count, now(),
    CASE WHEN v_retryable AND v_attempt_count < 5 THEN now() + make_interval(secs => v_delay_seconds) ELSE NULL END,
    NULL, NULL, NULL
  )
  ON CONFLICT (user_id, idempotency_key) DO UPDATE SET
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
    stage = EXCLUDED.stage,
    error_code = EXCLUDED.error_code,
    last_error_message = EXCLUDED.last_error_message,
    status = EXCLUDED.status,
    attempt_count = EXCLUDED.attempt_count,
    last_failed_at = EXCLUDED.last_failed_at,
    next_retry_at = EXCLUDED.next_retry_at,
    processing_started_at = NULL,
    completed_at = NULL,
    resolved_at = NULL;
END;
$function$;