-- Permanent jewel awards. Current streak remains volatile; awards are append-only
-- for normal application roles and are granted only by a trusted database trigger.
CREATE TABLE IF NOT EXISTS public.permanent_jewel_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jewel_index integer NOT NULL CHECK (jewel_index BETWEEN 0 AND 9),
  jewel_code text NOT NULL CHECK (jewel_code IN (
    'bronze', 'silver', 'gold', 'sapphire', 'ruby',
    'emerald', 'amethyst', 'pearl', 'obsidian', 'diamond'
  )),
  granted_at timestamptz NOT NULL DEFAULT now(),
  rule_version text NOT NULL DEFAULT 'streak-jewels-v1',
  CONSTRAINT permanent_jewel_awards_user_index_unique UNIQUE (user_id, jewel_index),
  CONSTRAINT permanent_jewel_awards_user_code_unique UNIQUE (user_id, jewel_code)
);

CREATE INDEX IF NOT EXISTS permanent_jewel_awards_user_granted_idx
  ON public.permanent_jewel_awards (user_id, granted_at DESC);

ALTER TABLE public.permanent_jewel_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.permanent_jewel_awards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.permanent_jewel_awards TO authenticated;
GRANT ALL ON public.permanent_jewel_awards TO service_role;

DROP POLICY IF EXISTS "Students read their own permanent jewel awards"
  ON public.permanent_jewel_awards;
CREATE POLICY "Students read their own permanent jewel awards"
  ON public.permanent_jewel_awards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- A single source of truth for jewel codes and their existing streak thresholds.
-- Bronze is earned on the first credited study day; each later jewel keeps the
-- existing seven-day cadence (Silver at 7, Gold at 14, ... Diamond at 63).
CREATE OR REPLACE FUNCTION public.grant_permanent_jewels_for_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only upward movement from a trusted streak update can award a jewel.
  -- Resetting or breaking a streak never deletes or downgrades an award.
  IF NEW.streak_days IS NULL OR NEW.streak_days <= COALESCE(OLD.streak_days, 0) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
  SELECT NEW.id, milestone.jewel_index, milestone.jewel_code
  FROM (VALUES
    (0, 'bronze', 1),
    (1, 'silver', 7),
    (2, 'gold', 14),
    (3, 'sapphire', 21),
    (4, 'ruby', 28),
    (5, 'emerald', 35),
    (6, 'amethyst', 42),
    (7, 'pearl', 49),
    (8, 'obsidian', 56),
    (9, 'diamond', 63)
  ) AS milestone(jewel_index, jewel_code, required_streak_days)
  WHERE NEW.streak_days >= milestone.required_streak_days
  ON CONFLICT (user_id, jewel_index) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_permanent_jewels_for_streak() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_permanent_jewels_for_streak() TO service_role;

DROP TRIGGER IF EXISTS profiles_grant_permanent_jewels ON public.profiles;
CREATE TRIGGER profiles_grant_permanent_jewels
AFTER UPDATE OF streak_days ON public.profiles
FOR EACH ROW
WHEN (NEW.streak_days IS DISTINCT FROM OLD.streak_days)
EXECUTE FUNCTION public.grant_permanent_jewels_for_streak();

NOTIFY pgrst, 'reload schema';
