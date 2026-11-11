-- Allow each learner to choose any 1–7 weekdays for My Study Plan.
-- Existing frequency presets are converted without changing study history.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS study_days text[];

UPDATE public.profiles
SET study_days = CASE study_days_per_week
  WHEN 2 THEN ARRAY['Tuesday', 'Thursday']::text[]
  WHEN 3 THEN ARRAY['Monday', 'Wednesday', 'Friday']::text[]
  WHEN 5 THEN ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[]
  WHEN 7 THEN ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[]
  ELSE ARRAY['Monday', 'Wednesday', 'Friday']::text[]
END
WHERE study_days IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN study_days SET DEFAULT ARRAY['Monday', 'Wednesday', 'Friday']::text[],
  ALTER COLUMN study_days SET NOT NULL;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%study_days_per_week%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_study_days_per_week_range
  CHECK (study_days_per_week IS NULL OR study_days_per_week BETWEEN 1 AND 7),
  ADD CONSTRAINT profiles_study_days_valid
  CHECK (
    cardinality(study_days) BETWEEN 1 AND 7
    AND study_days <@ ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[]
  );
