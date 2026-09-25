ALTER TABLE public.ai_limits ADD COLUMN IF NOT EXISTS global_max_concurrent integer NULL;
COMMENT ON COLUMN public.ai_limits.global_max_concurrent IS 'Max simultaneous pending requests of this operation across ALL users. NULL = no global limit.';

DROP FUNCTION IF EXISTS public.reserve_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer);

CREATE FUNCTION public.reserve_ai_usage(p_user_id uuid, p_operation text, p_model text, p_request_hash text, p_daily_limit integer, p_monthly_limit integer, p_premium_daily_limit integer, p_premium_monthly_limit integer, p_min_interval_seconds integer, p_max_concurrent integer, p_global_max_concurrent integer DEFAULT NULL)
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
  v_global_pending integer;
  v_last_created timestamptz;
  v_event_id uuid;
  v_retry integer;
BEGIN
  IF p_operation NOT IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary','teacher') THEN
    RAISE EXCEPTION 'unknown_ai_operation';
  END IF;

  -- Global lock first (only when a global limit is configured), then the per-user lock:
  -- fixed order prevents deadlocks; the global lock serializes check + insert across instances.
  IF p_global_max_concurrent IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('global:' || p_operation));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_operation));

  IF p_global_max_concurrent IS NOT NULL THEN
    SELECT count(*) INTO v_global_pending
    FROM public.ai_usage_events
    WHERE operation = p_operation
      AND status = 'pending'
      AND created_at > now() - interval '10 minutes';
    IF v_global_pending >= p_global_max_concurrent THEN
      INSERT INTO public.ai_usage_events(user_id, operation, model, request_hash, status, success, error_code, error_message, completed_at)
      VALUES (p_user_id, p_operation, p_model, p_request_hash, 'denied', false, 'global_concurrency_limit', 'Global concurrency limit reached', now())
      RETURNING id INTO v_event_id;
      RETURN QUERY SELECT false, v_event_id, 'global_concurrency_limit'::text, 3;
      RETURN;
    END IF;
  END IF;

  v_is_premium := public.has_active_entitlement(p_user_id, 'ai_teacher')
    OR public.has_active_entitlement(p_user_id, 'ai_talking')
    OR public.has_active_entitlement(p_user_id, 'writing_correction')
    OR public.has_active_entitlement(p_user_id, 'advanced_reports');

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

REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, integer) TO service_role;