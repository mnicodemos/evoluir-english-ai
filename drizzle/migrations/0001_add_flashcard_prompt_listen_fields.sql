ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS prompt text DEFAULT '',
  ADD COLUMN IF NOT EXISTS answer text DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_type text DEFAULT 'vocabulary',
  ADD COLUMN IF NOT EXISTS listen_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

UPDATE public.flashcards
SET
  prompt = COALESCE(NULLIF(prompt, ''), word),
  answer = COALESCE(NULLIF(answer, ''), NULLIF(definition, ''), NULLIF(example, ''), word),
  card_type = COALESCE(NULLIF(card_type, ''), 'vocabulary'),
  listen_text = COALESCE(listen_text, ''),
  sort_order = COALESCE(sort_order, 0);