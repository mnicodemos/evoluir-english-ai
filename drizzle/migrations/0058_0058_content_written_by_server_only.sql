REVOKE INSERT, UPDATE, DELETE ON public.lessons FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quizzes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.flashcards FROM anon, authenticated;
REVOKE INSERT (id, lesson_id, question, question_type, options, correct_answer, explanation, sort_order, created_at, created_by, pedagogical_skill)
  ON public.quizzes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO service_role;
NOTIFY pgrst, 'reload schema';