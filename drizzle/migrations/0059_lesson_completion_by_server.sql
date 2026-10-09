-- Security audit (2026-10-09): a lesson is completed only by the server
-- (completeLessonFromQuiz, from the quiz result it graded). The browser keeps
-- writing the video progress of its own rows (RLS still limits it to them),
-- but can no longer set completed_at/progress, change which lesson a row is
-- for, or delete rows.
-- Apply AFTER the app version that completes lessons on the server is published.
-- Idempotent: REVOKE and GRANT can run more than once.

REVOKE INSERT, UPDATE, DELETE ON public.user_lessons FROM anon, authenticated;
GRANT INSERT (user_id, lesson_id, video_progress, video_completed_at)
  ON public.user_lessons TO authenticated;
GRANT UPDATE (video_progress, video_completed_at)
  ON public.user_lessons TO authenticated;
GRANT SELECT ON public.user_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lessons TO service_role;

NOTIFY pgrst, 'reload schema';
