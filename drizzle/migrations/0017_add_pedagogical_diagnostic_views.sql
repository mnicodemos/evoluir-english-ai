-- Read-only operational diagnostics for the pedagogical pipeline.
-- Both views stay server-side only: no grants to anon or authenticated.

CREATE OR REPLACE VIEW public.unresolved_pedagogical_failures AS
SELECT
  failure.id AS failure_id,
  failure.user_id,
  failure.source_type,
  failure.source_id,
  failure.idempotency_key,
  failure.stage,
  failure.error_code,
  failure.status,
  failure.attempt_count,
  failure.next_retry_at,
  failure.first_failed_at AS created_at,
  failure.last_failed_at AS updated_at,
  failure.last_error_message
FROM public.pedagogical_dual_write_failures AS failure
WHERE failure.status <> 'completed'
  AND failure.resolved_at IS NULL;

REVOKE ALL ON public.unresolved_pedagogical_failures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.unresolved_pedagogical_failures TO service_role;

CREATE OR REPLACE VIEW public.orphan_quiz_results AS
SELECT
  result.id AS quiz_result_id,
  result.user_id,
  result.lesson_id,
  result.attempt_key,
  result.created_at,
  session.id AS assessment_session_id,
  session.status AS assessment_session_status,
  CASE
    WHEN session.id IS NULL THEN 'missing_assessment_session'
    WHEN evidence.evidence_count = 0 THEN 'missing_assessment_evidence'
    ELSE 'missing_skill_result'
  END AS orphan_reason
FROM public.quiz_results AS result
LEFT JOIN public.assessment_sessions AS session
  ON session.user_id = result.user_id
 AND session.source_type = 'quiz'
 AND session.source_id = result.id
LEFT JOIN LATERAL (
  SELECT count(*) AS evidence_count
  FROM public.assessment_evidence AS item
  WHERE item.assessment_session_id = session.id
) AS evidence ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS result_count
  FROM public.assessment_skill_results AS skill_result
  WHERE skill_result.assessment_session_id = session.id
) AS skill ON true
WHERE session.id IS NULL
   OR COALESCE(evidence.evidence_count, 0) = 0
   OR COALESCE(skill.result_count, 0) = 0;

REVOKE ALL ON public.orphan_quiz_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.orphan_quiz_results TO service_role;

NOTIFY pgrst, 'reload schema';