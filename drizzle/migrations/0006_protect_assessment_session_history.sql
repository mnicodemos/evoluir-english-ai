CREATE OR REPLACE FUNCTION public.protect_assessment_session_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF OLD.status IS DISTINCT FROM 'started' THEN
      RAISE EXCEPTION 'assessment_session_is_immutable';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.assessment_type IS DISTINCT FROM OLD.assessment_type
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.ruleset_version IS DISTINCT FROM OLD.ruleset_version
      OR NEW.rubric_version IS DISTINCT FROM OLD.rubric_version
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'assessment_session_identity_is_immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_assessment_session_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_assessment_session_history() TO service_role;
CREATE TRIGGER assessment_sessions_protect_history
BEFORE UPDATE ON public.assessment_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_assessment_session_history();