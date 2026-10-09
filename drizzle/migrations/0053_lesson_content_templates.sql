CREATE TABLE IF NOT EXISTS public.lesson_content_templates (
  curriculum_key text NOT NULL,
  prompt_hash text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (curriculum_key, prompt_hash)
);

ALTER TABLE public.lesson_content_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_content_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lesson_content_templates TO service_role;

NOTIFY pgrst, 'reload schema';