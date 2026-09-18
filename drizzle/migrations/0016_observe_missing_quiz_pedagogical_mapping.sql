CREATE OR REPLACE FUNCTION public.record_pedagogical_failure(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_stage text,
  p_error_code text,
  p_error_message text,
  p_already_claimed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT','MISSING_PEDAGOGICAL_MAPPING');
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
$$;

CREATE OR REPLACE FUNCTION public.record_claimed_pedagogical_failure(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_stage text,
  p_error_code text,
  p_error_message text,
  p_claimed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT','MISSING_PEDAGOGICAL_MAPPING');
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
$$;

REVOKE ALL ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';