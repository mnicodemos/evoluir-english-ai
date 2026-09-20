ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS study_focus text,
  ADD COLUMN IF NOT EXISTS study_days_per_week integer;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_study_focus_check
  CHECK (study_focus IS NULL OR study_focus IN ('grammar','listening','speaking','vocabulary','writing','balanced'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_study_days_per_week_check
  CHECK (study_days_per_week IS NULL OR study_days_per_week IN (2,3,5,7));