-- Diamond cycles (owner decision, 2026-10-31): after the Diamond (63 days in a
-- row), every further 63 days in a row earn "Diamond x2", "x3", ... instead of
-- new jewels. Like the jewels, a cycle is permanent once earned, granted only
-- by the database (a trigger on profiles.streak_days, the sole streak writer
-- being credit_study_day) and read by the student for their own rows only.
-- Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.diamond_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle integer NOT NULL CHECK (cycle >= 2),
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diamond_cycles_user_cycle_unique UNIQUE (user_id, cycle)
);

ALTER TABLE public.diamond_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diamond_cycles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diamond_cycles TO authenticated;
GRANT ALL ON public.diamond_cycles TO service_role;

DROP POLICY IF EXISTS "Students read their own diamond cycles" ON public.diamond_cycles;
CREATE POLICY "Students read their own diamond cycles"
  ON public.diamond_cycles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Grants each cycle the first time the streak crosses 63 x cycle.
CREATE OR REPLACE FUNCTION public.grant_diamond_cycles_for_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.streak_days IS NULL OR NEW.streak_days <= COALESCE(OLD.streak_days, 0) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.diamond_cycles (user_id, cycle)
  SELECT NEW.id, cycle_number
  FROM generate_series(2, NEW.streak_days / 63) AS cycle_number
  WHERE COALESCE(OLD.streak_days, 0) < cycle_number * 63
  ON CONFLICT (user_id, cycle) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_diamond_cycles_for_streak() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_diamond_cycles_for_streak() TO service_role;

DROP TRIGGER IF EXISTS profiles_grant_diamond_cycles ON public.profiles;
CREATE TRIGGER profiles_grant_diamond_cycles
AFTER UPDATE OF streak_days ON public.profiles
FOR EACH ROW
WHEN (NEW.streak_days IS DISTINCT FROM OLD.streak_days)
EXECUTE FUNCTION public.grant_diamond_cycles_for_streak();

-- Backfill from the current streak and the longest run of credited study days.
WITH numbered_days AS (
  SELECT user_id, day,
    day - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day)::int AS streak_group
  FROM public.study_days
),
longest AS (
  SELECT user_id, MAX(run_length)::int AS longest_run
  FROM (
    SELECT user_id, streak_group, COUNT(*)::int AS run_length
    FROM numbered_days
    GROUP BY user_id, streak_group
  ) AS runs
  GROUP BY user_id
),
best AS (
  SELECT p.id AS user_id,
    GREATEST(COALESCE(l.longest_run, 0), COALESCE(p.streak_days, 0)) AS best_streak
  FROM public.profiles AS p
  LEFT JOIN longest AS l ON l.user_id = p.id
)
INSERT INTO public.diamond_cycles (user_id, cycle)
SELECT best.user_id, cycle_number
FROM best
CROSS JOIN LATERAL generate_series(2, best.best_streak / 63) AS cycle_number
ON CONFLICT (user_id, cycle) DO NOTHING;

NOTIFY pgrst, 'reload schema';
