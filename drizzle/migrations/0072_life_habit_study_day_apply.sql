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