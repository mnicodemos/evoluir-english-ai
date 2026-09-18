REVOKE SELECT ON TABLE public.quizzes FROM PUBLIC;
REVOKE SELECT ON TABLE public.quizzes FROM anon;
REVOKE SELECT ON TABLE public.quizzes FROM authenticated;

GRANT SELECT (
  id,
  lesson_id,
  question,
  question_type,
  options,
  explanation,
  sort_order,
  created_at,
  created_by,
  pedagogical_skill
) ON public.quizzes TO authenticated;

GRANT ALL ON TABLE public.quizzes TO service_role;

NOTIFY pgrst, 'reload schema';