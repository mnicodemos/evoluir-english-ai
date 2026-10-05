-- "My mistakes": each structured mistake climbs a spaced-review ladder.
-- review_step 0..5 (5 = mastered); next_review_at is when it is due again.
-- Writes stay server-only (service_role), as for the rest of this table.
ALTER TABLE public.learning_errors
  ADD COLUMN IF NOT EXISTS review_step integer NOT NULL DEFAULT 0 CHECK (review_step BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS learning_errors_user_due_idx
  ON public.learning_errors (user_id, next_review_at);
