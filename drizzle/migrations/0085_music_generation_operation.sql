-- Add Music Lab to the AI usage operation allowlist without changing existing operations.
DO $$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO existing_definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ai_usage_events'
    AND c.conname = 'ai_usage_events_operation_check';

  IF existing_definition IS NULL THEN
    ALTER TABLE public.ai_usage_events
      ADD CONSTRAINT ai_usage_events_operation_check
      CHECK (operation IN (
        'chat', 'talking', 'tts', 'transcription', 'lesson_generation',
        'quiz_generation', 'vocabulary_generation', 'writing_correction',
        'dictionary', 'teacher', 'music_generation'
      ));
  ELSIF existing_definition NOT LIKE '%music_generation%' THEN
    ALTER TABLE public.ai_usage_events
      DROP CONSTRAINT ai_usage_events_operation_check;
    ALTER TABLE public.ai_usage_events
      ADD CONSTRAINT ai_usage_events_operation_check
      CHECK (operation IN (
        'chat', 'talking', 'tts', 'transcription', 'lesson_generation',
        'quiz_generation', 'vocabulary_generation', 'writing_correction',
        'dictionary', 'teacher', 'music_generation'
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
