ALTER TABLE public.user_vocabulary
  ADD COLUMN next_review_at timestamptz;

CREATE INDEX user_vocabulary_due_idx
  ON public.user_vocabulary (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

COMMENT ON COLUMN public.user_vocabulary.next_review_at IS
  'Spaced-review due date for "I know it"; NULL = not scheduled or fully mastered.';