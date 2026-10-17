-- Life+ AI habit linked to the English study day (user report, 2026-10-17:
-- a "Study English" habit showed a run of 1 beside a 30-day study streak).
-- A habit with linked = 'study_day' takes its check-ins from study_days
-- (migration 0063, written only by credit_study_day), so the habit and the
-- streak always agree; the server ignores manual ticks for it.
-- Idempotent: IF NOT EXISTS and a guarded constraint.

ALTER TABLE public.life_habits ADD COLUMN IF NOT EXISTS linked text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'life_habits_linked_check'
  ) THEN
    ALTER TABLE public.life_habits
      ADD CONSTRAINT life_habits_linked_check CHECK (linked IS NULL OR linked IN ('study_day'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
