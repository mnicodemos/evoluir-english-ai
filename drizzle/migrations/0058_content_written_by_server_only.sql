-- Security audit (2026-10-09): lessons, quizzes and flashcards are written only
-- by the server with the service role (contentWriter in
-- src/lib/curriculumContent.server.ts). A student's own session could insert a
-- lesson with a Final Test key and quiz rows whose answers it chose, then pass
-- the test; students now only read these tables.
-- Apply AFTER the app version that writes with the service role is published.
-- Idempotent: REVOKE and GRANT can run more than once.

REVOKE INSERT, UPDATE, DELETE ON public.lessons FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quizzes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.flashcards FROM anon, authenticated;
-- Column-level INSERT on quizzes (migration 0028) is a separate privilege.
REVOKE INSERT (id, lesson_id, question, question_type, options, correct_answer, explanation, sort_order, created_at, created_by, pedagogical_skill)
  ON public.quizzes FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO service_role;

NOTIFY pgrst, 'reload schema';
