CREATE OR REPLACE FUNCTION public.credit_study_day(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_profile public.profiles%ROWTYPE;
  v_ok boolean;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.last_activity_date = v_today THEN RETURN; END IF;

  v_ok :=
    (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'writing'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'listening'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.user_vocabulary
       WHERE user_id = p_user_id AND last_reviewed_at IS NOT NULL
         AND (last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 10
    OR EXISTS (SELECT 1 FROM public.user_lessons
       WHERE user_id = p_user_id AND completed_at IS NOT NULL
         AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today);

  IF v_ok THEN
    UPDATE public.profiles
    SET streak_days = CASE WHEN last_activity_date = v_today - 1 THEN streak_days + 1 ELSE 1 END,
        last_activity_date = v_today
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_study_day_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.credit_study_day(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_study_day_activities
AFTER INSERT ON public.activities
FOR EACH ROW WHEN (NEW.activity_type IN ('writing','listening'))
EXECUTE FUNCTION public.credit_study_day_trigger();

CREATE TRIGGER credit_study_day_user_lessons
AFTER INSERT OR UPDATE OF completed_at ON public.user_lessons
FOR EACH ROW WHEN (NEW.completed_at IS NOT NULL)
EXECUTE FUNCTION public.credit_study_day_trigger();

CREATE TRIGGER credit_study_day_user_vocabulary
AFTER INSERT OR UPDATE OF last_reviewed_at ON public.user_vocabulary
FOR EACH ROW WHEN (NEW.last_reviewed_at IS NOT NULL)
EXECUTE FUNCTION public.credit_study_day_trigger();

CREATE OR REPLACE FUNCTION public.persist_authoritative_legacy_activity(p_user_id uuid, p_source_type text, p_operation_key uuid, p_source_id uuid, p_activity_type text, p_title text, p_duration_minutes integer, p_score integer, p_scores jsonb, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_existing public.activities%ROWTYPE;
  v_previous public.progress%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_operation_key IS NULL
    OR p_source_type NOT IN ('quiz','writing','listening','pronunciation','talking','telemetry')
    OR p_duration_minutes < 0 OR p_duration_minutes > 1440
    OR p_score IS NOT NULL AND (p_score < 0 OR p_score > 100)
    OR jsonb_typeof(COALESCE(p_scores, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_legacy_activity' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':legacy:' || p_source_type || ':' || p_operation_key::text));

  SELECT * INTO v_existing
  FROM public.activities
  WHERE user_id = p_user_id AND source_type = p_source_type AND operation_key = p_operation_key;

  IF FOUND THEN
    IF v_existing.activity_type IS DISTINCT FROM p_activity_type
      OR v_existing.source_id IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'legacy_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('duplicate', true, 'activity_id', v_existing.id, 'score', v_existing.score, 'result', v_existing.result);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.activities (
    user_id, activity_type, title, duration_minutes, score, level,
    operation_key, source_type, source_id, operation_status, result
  ) VALUES (
    p_user_id, p_activity_type, left(p_title, 240), p_duration_minutes, p_score,
    v_profile.level, p_operation_key, p_source_type, p_source_id, 'completed', COALESCE(p_result, '{}'::jsonb)
  ) RETURNING * INTO v_existing;

  -- Study streak days are credited by public.credit_study_day (daily goal rule).

  IF p_scores <> '{}'::jsonb THEN
    SELECT * INTO v_previous
    FROM public.progress
    WHERE user_id = p_user_id AND level = v_profile.level
    ORDER BY recorded_at DESC
    LIMIT 1
    FOR UPDATE;

    INSERT INTO public.progress (
      user_id, level, speaking_score, reading_score, grammar_score,
      listening_score, vocabulary_score, writing_score
    ) VALUES (
      p_user_id,
      v_profile.level,
      GREATEST(COALESCE(v_previous.speaking_score, 0), COALESCE((p_scores->>'speaking')::integer, COALESCE(v_previous.speaking_score, 0))),
      GREATEST(COALESCE(v_previous.reading_score, 0), COALESCE((p_scores->>'reading')::integer, COALESCE(v_previous.reading_score, 0))),
      GREATEST(COALESCE(v_previous.grammar_score, 0), COALESCE((p_scores->>'grammar')::integer, COALESCE(v_previous.grammar_score, 0))),
      GREATEST(COALESCE(v_previous.listening_score, 0), COALESCE((p_scores->>'listening')::integer, COALESCE(v_previous.listening_score, 0))),
      GREATEST(COALESCE(v_previous.vocabulary_score, 0), COALESCE((p_scores->>'vocabulary')::integer, COALESCE(v_previous.vocabulary_score, 0))),
      GREATEST(COALESCE(v_previous.writing_score, 0), COALESCE((p_scores->>'writing')::integer, COALESCE(v_previous.writing_score, 0)))
    );
  END IF;

  RETURN jsonb_build_object('duplicate', false, 'activity_id', v_existing.id, 'score', v_existing.score, 'result', v_existing.result);
END;
$function$;