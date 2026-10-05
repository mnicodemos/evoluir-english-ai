-- The CEFR level only goes up through the server (promoteAfterFinalTest, which
-- re-checks the stored Final Test result) or the placement during onboarding.
-- After onboarding a browser request may move `level` back and forth among
-- the levels already reached (<= max_level) but can never raise max_level,
-- jump above it, or reopen onboarding. Service-role and SECURITY DEFINER
-- writers are not affected (SECURITY INVOKER: current_user is the caller).
CREATE OR REPLACE FUNCTION public.cefr_rank(p_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_level, ''))
    WHEN 'a1' THEN 1 WHEN 'basic' THEN 1 WHEN 'beginner' THEN 1
    WHEN 'a2' THEN 2 WHEN 'elementary' THEN 2
    WHEN 'b1' THEN 3 WHEN 'intermediate' THEN 3
    WHEN 'b2' THEN 4 WHEN 'upper-intermediate' THEN 4
    WHEN 'c1' THEN 5 WHEN 'advanced' THEN 5
    WHEN 'c2' THEN 6 WHEN 'proficient' THEN 6
    ELSE 3 -- same fallback as findLevel() in the app (B1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_level_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A profile created by the browser starts before the placement test.
    NEW.onboarding_completed := false;
    NEW.max_level := NEW.level;
    RETURN NEW;
  END IF;

  IF NOT OLD.onboarding_completed THEN
    -- Placement: the chosen level is also the highest level reached so far.
    IF public.cefr_rank(NEW.max_level) > public.cefr_rank(NEW.level) THEN
      NEW.max_level := NEW.level;
    END IF;
    RETURN NEW;
  END IF;

  NEW.onboarding_completed := true;
  NEW.max_level := OLD.max_level;
  IF public.cefr_rank(NEW.level) > public.cefr_rank(OLD.max_level) THEN
    NEW.level := OLD.level;
  END IF;
  RETURN NEW;
END;
$$;

-- "zz_" keeps this BEFORE trigger after the others on profiles (they fire in
-- name order), so it has the last word on these columns.
DROP TRIGGER IF EXISTS zz_profiles_protect_level_fields ON public.profiles;
CREATE TRIGGER zz_profiles_protect_level_fields
BEFORE INSERT OR UPDATE OF level, max_level, onboarding_completed
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_level_fields();
