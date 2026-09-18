-- Allow the additive 'teacher' AI operation in the existing usage telemetry table.
ALTER TABLE public.ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_operation_check;
ALTER TABLE public.ai_usage_events
  ADD CONSTRAINT ai_usage_events_operation_check
  CHECK (operation = ANY (ARRAY['chat'::text, 'talking'::text, 'tts'::text, 'transcription'::text,
    'lesson_generation'::text, 'quiz_generation'::text, 'vocabulary_generation'::text,
    'writing_correction'::text, 'dictionary'::text, 'teacher'::text]));

NOTIFY pgrst, 'reload schema';