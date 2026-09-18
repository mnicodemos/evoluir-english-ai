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

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT');
  v_delay_seconds := LEAST(3600, (15 * power(2, LEAST(v_row.attempt_count - 1, 8)))::integer);

  UPDATE public.pedagogical_dual_write_failures
  SET source_type = p_source_type,
      source_id = p_source_id,
      stage = p_stage,
      error_code = p_error_code,
      last_error_message = left(p_error_message, 240),
      status = CASE WHEN v_retryable AND v_row.attempt_count < 5 THEN 'pending' ELSE 'failed' END,
      last_failed_at = now(),
      next_retry_at = CASE
        WHEN v_retryable AND v_row.attempt_count < 5
        THEN now() + make_interval(secs => v_delay_seconds)
        ELSE NULL
      END,
      processing_started_at = NULL,
      completed_at = NULL,
      resolved_at = NULL
  WHERE id = v_row.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_claimed_pedagogical_failure(
  p_user_id uuid,
  p_idempotency_key text,
  p_claimed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.pedagogical_dual_write_failures
  SET status = 'completed',
      resolved_at = now(),
      completed_at = now(),
      processing_started_at = NULL,
      next_retry_at = NULL
  WHERE user_id = p_user_id
    AND idempotency_key = p_idempotency_key
    AND processing_started_at = p_claimed_at
    AND status IN ('processing', 'retrying');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_claimed_pedagogical_failure(uuid, text, uuid, text, text, text, text, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_claimed_pedagogical_failure(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_claimed_pedagogical_failure(uuid, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_claimed_pedagogical_failure(uuid, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_claimed_pedagogical_failure(uuid, text, timestamptz) TO service_role;