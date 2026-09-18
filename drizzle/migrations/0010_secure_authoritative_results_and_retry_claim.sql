REVOKE INSERT, UPDATE, DELETE ON public.quiz_results FROM authenticated;
GRANT SELECT ON public.quiz_results TO authenticated;
GRANT ALL ON public.quiz_results TO service_role;

DROP POLICY IF EXISTS "own quiz results" ON public.quiz_results;
CREATE POLICY "Users can view own quiz results"
ON public.quiz_results
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX pedagogical_dual_write_failures_stale_idx
ON public.pedagogical_dual_write_failures (processing_started_at)
WHERE status IN ('processing', 'retrying');

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
        processing_started_at = now()
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

REVOKE ALL ON FUNCTION public.claim_pedagogical_retries(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pedagogical_retries(uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_pedagogical_retries(uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pedagogical_retries(uuid, integer, integer) TO service_role;