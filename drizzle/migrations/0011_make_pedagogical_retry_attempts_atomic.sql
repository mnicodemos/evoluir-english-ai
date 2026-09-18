ALTER TABLE public.pedagogical_dual_write_failures
ADD CONSTRAINT pedagogical_dual_write_failures_attempt_cap_check
CHECK (attempt_count BETWEEN 1 AND 5);

CREATE OR REPLACE FUNCTION public.claim_pedagogical_retries(
  p_user_id uuid,
  p_limit integer DEFAULT 3,
  p_stale_seconds integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  idempotency_key text,
  attempt_count integer,
  claimed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_limit < 1 OR p_limit > 5 OR p_stale_seconds < 60 OR p_stale_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid_retry_claim_parameters' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT failure.id
    FROM public.pedagogical_dual_write_failures AS failure
    WHERE failure.user_id = p_user_id
      AND failure.attempt_count < 5
      AND (
        (
          failure.status = 'pending'
          AND (failure.next_retry_at IS NULL OR failure.next_retry_at <= now())
        )
        OR (
          failure.status IN ('processing', 'retrying')
          AND failure.processing_started_at IS NOT NULL
          AND failure.processing_started_at <= now() - make_interval(secs => p_stale_seconds)
        )
      )
    ORDER BY COALESCE(failure.next_retry_at, failure.processing_started_at, failure.last_failed_at)
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.pedagogical_dual_write_failures AS failure
    SET status = 'processing',
        processing_started_at = now(),
        attempt_count = LEAST(failure.attempt_count + 1, 5)
    FROM candidates
    WHERE failure.id = candidates.id
      AND failure.user_id = p_user_id
    RETURNING failure.id,
      failure.source_type,
      failure.source_id,
      failure.idempotency_key,
      failure.attempt_count,
      failure.processing_started_at
  )
  SELECT claimed.id,
    claimed.source_type,
    claimed.source_id,
    claimed.idempotency_key,
    claimed.attempt_count,
    claimed.processing_started_at
  FROM claimed;
END;
$$;

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
  v_retryable := p_error_code NOT IN ('AUTHORIZATION_FAILED','VALIDATION_FAILED','IDEMPOTENCY_CONFLICT');
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

REVOKE ALL ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_pedagogical_failure(uuid, text, uuid, text, text, text, text, boolean) TO service_role;