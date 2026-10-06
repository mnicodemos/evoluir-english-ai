-- Time until the first word (AI Speaking) or first sound (TTS) reached the
-- student, in milliseconds. Written only by streaming calls; NULL elsewhere.
-- The admin panel reads it as "First chunk". Idempotent.
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS first_chunk_ms integer;

NOTIFY pgrst, 'reload schema';
