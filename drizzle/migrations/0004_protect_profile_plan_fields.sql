CREATE OR REPLACE FUNCTION public.protect_profile_plan_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.plan := OLD.plan;
    NEW.plan_interval := OLD.plan_interval;
    NEW.plan_started_at := OLD.plan_started_at;
    NEW.plan_expires_at := OLD.plan_expires_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_plan_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_plan_fields() TO service_role;
CREATE TRIGGER profiles_protect_plan_fields
BEFORE UPDATE OF plan, plan_interval, plan_started_at, plan_expires_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_fields();