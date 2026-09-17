DROP TRIGGER IF EXISTS profiles_comp_premium ON public.profiles;

CREATE OR REPLACE FUNCTION public.apply_comp_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_comp_premium() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_profile_max_level() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_comp_premium() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_max_level() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE TABLE public.ai_limits (
  operation text PRIMARY KEY CHECK (operation IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary')),
  daily_limit integer NOT NULL CHECK (daily_limit >= 0),
  monthly_limit integer NOT NULL CHECK (monthly_limit >= 0),
  premium_daily_limit integer NOT NULL CHECK (premium_daily_limit >= 0),
  premium_monthly_limit integer NOT NULL CHECK (premium_monthly_limit >= 0),
  min_interval_seconds integer NOT NULL DEFAULT 0 CHECK (min_interval_seconds >= 0),
  max_concurrent integer NOT NULL DEFAULT 1 CHECK (max_concurrent > 0),
  cache_ttl_seconds integer NOT NULL DEFAULT 0 CHECK (cache_ttl_seconds >= 0),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_limits TO service_role;
ALTER TABLE public.ai_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary')),
  model text NOT NULL DEFAULT '',
  request_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','error','denied')),
  success boolean,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost numeric(12,6) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT ALL ON public.ai_usage_events TO service_role;
GRANT SELECT ON public.ai_usage_events TO authenticated;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own AI usage"
ON public.ai_usage_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE INDEX ai_usage_user_operation_created_idx
ON public.ai_usage_events (user_id, operation, created_at DESC);
CREATE INDEX ai_usage_pending_idx
ON public.ai_usage_events (user_id, operation, created_at)
WHERE status = 'pending';

CREATE TABLE public.ai_response_cache (
  cache_key text PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary')),
  model text NOT NULL,
  response_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  last_hit_at timestamptz
);
GRANT ALL ON public.ai_response_cache TO service_role;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_response_cache_expiry_idx ON public.ai_response_cache (expires_at);

CREATE TABLE public.learning_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type text NOT NULL,
  category text NOT NULL,
  original_text text NOT NULL,
  corrected_text text NOT NULL,
  explanation text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  skill text NOT NULL,
  frequency integer NOT NULL DEFAULT 1 CHECK (frequency > 0),
  first_detected timestamptz NOT NULL DEFAULT now(),
  last_detected timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'ai'
);
GRANT ALL ON public.learning_errors TO service_role;
GRANT SELECT ON public.learning_errors TO authenticated;
ALTER TABLE public.learning_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own structured errors"
ON public.learning_errors FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE INDEX learning_errors_user_skill_idx
ON public.learning_errors (user_id, skill, last_detected DESC);

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_user_id uuid,
  p_operation text,
  p_model text,
  p_request_hash text,
  p_daily_limit integer,
  p_monthly_limit integer,
  p_premium_daily_limit integer,
  p_premium_monthly_limit integer,
  p_min_interval_seconds integer,
  p_max_concurrent integer
)
RETURNS TABLE(allowed boolean, event_id uuid, reason text, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF p_operation NOT IN ('chat','talking','tts','transcription','lesson_generation','quiz_generation','vocabulary_generation','writing_correction','dictionary') THEN
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
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid,text,text,text,integer,integer,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid,text,text,text,integer,integer,integer,integer,integer,integer) TO service_role;