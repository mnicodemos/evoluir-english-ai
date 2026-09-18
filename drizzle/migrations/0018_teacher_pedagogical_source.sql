-- FASE 3 — AI Teacher backend: additive extension of existing source/operation
-- enums so a teacher interaction reuses assessment_sessions, assessment_evidence,
-- assessment_skill_results, persist_pedagogical_bundle and the AI usage controls.
-- No scoring, CEFR, confidence or aggregation rule is changed here.

ALTER TABLE public.assessment_sessions
  DROP CONSTRAINT IF EXISTS assessment_sessions_source_type_check;
ALTER TABLE public.assessment_sessions
  ADD CONSTRAINT assessment_sessions_source_type_check
  CHECK (source_type IS NULL OR source_type = ANY (ARRAY['quiz'::text, 'writing'::text, 'teacher'::text]));

ALTER TABLE public.assessment_evidence
  DROP CONSTRAINT IF EXISTS assessment_evidence_source_type_check;
ALTER TABLE public.assessment_evidence
  ADD CONSTRAINT assessment_evidence_source_type_check
  CHECK (source_type = ANY (ARRAY['placement'::text, 'quiz'::text, 'writing'::text, 'speaking'::text,
    'listening'::text, 'pronunciation'::text, 'vocabulary'::text, 'reading'::text, 'final_test'::text,
    'teacher'::text]));

ALTER TABLE public.pedagogical_dual_write_failures
  DROP CONSTRAINT IF EXISTS pedagogical_dual_write_failures_source_type_check;
ALTER TABLE public.pedagogical_dual_write_failures
  ADD CONSTRAINT pedagogical_dual_write_failures_source_type_check
  CHECK (source_type = ANY (ARRAY['quiz'::text, 'writing'::text, 'teacher'::text]));

ALTER TABLE public.ai_limits
  DROP CONSTRAINT IF EXISTS ai_limits_operation_check;
ALTER TABLE public.ai_limits
  ADD CONSTRAINT ai_limits_operation_check
  CHECK (operation = ANY (ARRAY['chat'::text, 'talking'::text, 'tts'::text, 'transcription'::text,
    'lesson_generation'::text, 'quiz_generation'::text, 'vocabulary_generation'::text,
    'writing_correction'::text, 'dictionary'::text, 'teacher'::text]));

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
  IF p_source_type NOT IN ('quiz', 'writing', 'teacher') THEN
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
    AND p_source_type IS DISTINCT FROM 'teacher';
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

CREATE OR REPLACE FUNCTION public.record_claimed_pedagogical_failure(p_user_id uuid, p_source_type text, p_source_id uuid, p_idempotency_key text, p_stage text, p_error_code text, p_error_message text, p_claimed_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.pedagogical_dual_write_failures%ROWTYPE;
  v_retryable boolean;
  v_delay_seconds integer;
BEGIN
  SELECT * INTO v_row
  FROM public.pedagogical_dual_write_failures
  WHERE user_id = p_user_id
    AND idempotency_key = p_idempotency_key
    AND processing_started_at = p_claimed_at
    AND status IN ('processing', 'retrying')
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT','MISSING_PEDAGOGICAL_MAPPING')
    AND p_source_type IS DISTINCT FROM 'teacher';
  v_delay_seconds := LEAST(3600, (15 * power(2, LEAST(v_row.attempt_count - 1, 8)))::integer);

  UPDATE public.pedagogical_dual_write_failures
  SET source_type = p_source_type,
      source_id = p_source_id,
      stage = p_stage,
      error_code = p_error_code,
      last_error_message = left(p_error_message, 240),
      status = CASE WHEN v_retryable AND v_row.attempt_count < 5 THEN 'pending' ELSE 'failed' END,
      last_failed_at = now(),
      next_retry_at = CASE WHEN v_retryable AND v_row.attempt_count < 5 THEN now() + make_interval(secs => v_delay_seconds) ELSE NULL END,
      processing_started_at = NULL,
      completed_at = NULL,
      resolved_at = NULL
  WHERE id = v_row.id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(p_user_id uuid, p_operation text, p_model text, p_request_hash text, p_daily_limit integer, p_monthly_limit integer, p_premium_daily_limit integer, p_premium_monthly_limit integer, p_min_interval_seconds integer, p_max_concurrent integer)
 RETURNS TABLE(allowed boolean, event_id uuid, reason text, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_premium boolean := false;
  v_daily_limit integer;
  v_monthly_limit integer;
  v_daily_count integer;
  v_monthly_count integer;
  v_pending_count integer;
  v_last_created timestamptz;
  v_event_id uuid;
  v_retry integer;
BEGIN
  IF p_operation NOT IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary','teacher') THEN
    RAISE EXCEPTION 'unknown_ai_operation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_operation));

  SELECT plan = 'premium' AND (plan_expires_at IS NULL OR plan_expires_at > now())
  INTO v_is_premium
  FROM public.profiles
  WHERE id = p_user_id;

  v_daily_limit := CASE WHEN coalesce(v_is_premium, false) THEN p_premium_daily_limit ELSE p_daily_limit END;
  v_monthly_limit := CASE WHEN coalesce(v_is_premium, false) THEN p_premium_monthly_limit ELSE p_monthly_limit END;

  SELECT count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),
         count(*) FILTER (WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),
         count(*) FILTER (WHERE status = 'pending' AND created_at > now() - interval '10 minutes'),
         max(created_at)
  INTO v_daily_count, v_monthly_count, v_pending_count, v_last_created
  FROM public.ai_usage_events
  WHERE user_id = p_user_id
    AND operation = p_operation
    AND status IN ('pending','completed');

  IF v_daily_count >= v_daily_limit THEN
    INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash, status, success, error_code, error_message, completed_at)
    VALUES (p_user_id, p_operation, p_model, p_request_hash, 'denied', false, 'daily_limit', 'Daily AI usage limit reached', now())
    RETURNING id INTO v_event_id;
    RETURN QUERY SELECT false, v_event_id, 'daily_limit'::text, 0;
    RETURN;
  END IF;

  IF v_monthly_count >= v_monthly_limit THEN
    INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash, status, success, error_code, error_message, completed_at)
    VALUES (p_user_id, p_operation, p_model, p_request_hash, 'denied', false, 'monthly_limit', 'Monthly AI usage limit reached', now())
    RETURNING id INTO v_event_id;
    RETURN QUERY SELECT false, v_event_id, 'monthly_limit'::text, 0;
    RETURN;
  END IF;

  IF v_pending_count >= p_max_concurrent THEN
    INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash, status, success, error_code, error_message, completed_at)
    VALUES (p_user_id, p_operation, p_model, p_request_hash, 'denied', false, 'concurrent_limit', 'Another AI request is already running', now())
    RETURNING id INTO v_event_id;
    RETURN QUERY SELECT false, v_event_id, 'concurrent_limit'::text, 2;
    RETURN;
  END IF;

  IF v_last_created IS NOT NULL AND v_last_created > now() - make_interval(secs => p_min_interval_seconds) THEN
    v_retry := greatest(1, ceil(extract(epoch FROM (v_last_created + make_interval(secs => p_min_interval_seconds) - now())))::integer);
    INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash, status, success, error_code, error_message, completed_at)
    VALUES (p_user_id, p_operation, p_model, p_request_hash, 'denied', false, 'rate_limit', 'AI requests are arriving too quickly', now())
    RETURNING id INTO v_event_id;
    RETURN QUERY SELECT false, v_event_id, 'rate_limit'::text, v_retry;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash)
  VALUES (p_user_id, p_operation, p_model, p_request_hash)
  RETURNING id INTO v_event_id;
  RETURN QUERY SELECT true, v_event_id, null::text, 0;
END;
$function$;

INSERT INTO public.ai_limits (
  operation, daily_limit, monthly_limit, premium_daily_limit, premium_monthly_limit,
  min_interval_seconds, max_concurrent, cache_ttl_seconds, enabled
) VALUES ('teacher', 60, 1000, 300, 6000, 1, 1, 0, true)
ON CONFLICT (operation) DO NOTHING;

NOTIFY pgrst, 'reload schema';