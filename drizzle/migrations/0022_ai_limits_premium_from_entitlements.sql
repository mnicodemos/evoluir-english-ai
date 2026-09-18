-- Phase 6C: AI limits stop reading profiles.plan; entitlements become the
-- commercial source of truth (reusing has_active_entitlement).

-- 1) One-time, non-destructive backfill so existing premium profiles keep
--    premium AI limits after the switch.
INSERT INTO public.entitlements (user_id, feature, plan, granted_at, expires_at)
SELECT p.id, f.feature, 'premium', COALESCE(p.plan_started_at, now()), p.plan_expires_at
FROM public.profiles p
CROSS JOIN (VALUES ('ai_teacher'), ('ai_talking'), ('writing_correction'), ('advanced_reports')) AS f(feature)
WHERE p.plan = 'premium'
  AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now())
ON CONFLICT (user_id, feature) DO NOTHING;

-- 2) Switch the authority inside the existing quota reservation function.
--    Only the premium detection block changes; limits, locking, rate limiting,
--    concurrency and auditing stay exactly as before.
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

  -- Commercial authority: a valid entitlement (Stripe -> subscriptions -> entitlements).
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