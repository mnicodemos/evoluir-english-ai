ALTER TABLE public.quiz_results
ADD COLUMN attempt_key uuid;

CREATE UNIQUE INDEX quiz_results_user_attempt_uq
ON public.quiz_results (user_id, attempt_key)
WHERE attempt_key IS NOT NULL;

ALTER TABLE public.pedagogical_dual_write_failures
ADD COLUMN last_error_message text,
ADD COLUMN next_retry_at timestamptz,
ADD COLUMN processing_started_at timestamptz,
ADD COLUMN completed_at timestamptz;

ALTER TABLE public.pedagogical_dual_write_failures
DROP CONSTRAINT pedagogical_dual_write_failures_stage_check;

ALTER TABLE public.pedagogical_dual_write_failures
ADD CONSTRAINT pedagogical_dual_write_failures_stage_check
CHECK (stage IN ('source','authorization','validation','session','evidence','aggregation','skill_result','cefr_calculation','finalization','idempotency'));

ALTER TABLE public.pedagogical_dual_write_failures
DROP CONSTRAINT pedagogical_dual_write_failures_status_check;

UPDATE public.pedagogical_dual_write_failures
SET status = 'completed', completed_at = COALESCE(resolved_at, now())
WHERE status = 'resolved';

ALTER TABLE public.pedagogical_dual_write_failures
ADD CONSTRAINT pedagogical_dual_write_failures_status_check
CHECK (status IN ('pending','processing','retrying','completed','failed'));

DROP INDEX IF EXISTS public.pedagogical_dual_write_failures_pending_idx;
CREATE INDEX pedagogical_dual_write_failures_retry_idx
ON public.pedagogical_dual_write_failures (user_id, next_retry_at, last_failed_at)
WHERE status IN ('pending','failed');

REVOKE INSERT, UPDATE, DELETE ON public.assessment_sessions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assessment_evidence FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assessment_skill_results FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.writing_submissions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pedagogical_dual_write_failures FROM authenticated;

DROP POLICY IF EXISTS "Users can create own assessment sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Users can update own assessment sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Users can create own assessment evidence" ON public.assessment_evidence;
DROP POLICY IF EXISTS "Users can create own assessment skill results" ON public.assessment_skill_results;
DROP POLICY IF EXISTS "Users can create own writing submissions" ON public.writing_submissions;
DROP POLICY IF EXISTS "Users can create own pedagogical dual write failures" ON public.pedagogical_dual_write_failures;
DROP POLICY IF EXISTS "Users can update own pedagogical dual write failures" ON public.pedagogical_dual_write_failures;

GRANT SELECT ON public.assessment_sessions TO authenticated;
GRANT SELECT ON public.assessment_evidence TO authenticated;
GRANT SELECT ON public.assessment_skill_results TO authenticated;
GRANT SELECT ON public.writing_submissions TO authenticated;
GRANT SELECT ON public.pedagogical_dual_write_failures TO authenticated;
GRANT ALL ON public.assessment_sessions TO service_role;
GRANT ALL ON public.assessment_evidence TO service_role;
GRANT ALL ON public.assessment_skill_results TO service_role;
GRANT ALL ON public.writing_submissions TO service_role;
GRANT ALL ON public.pedagogical_dual_write_failures TO service_role;