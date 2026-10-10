ALTER TABLE public.vocabulary DROP CONSTRAINT IF EXISTS vocabulary_word_key;
DROP INDEX IF EXISTS public.vocabulary_word_key;
NOTIFY pgrst, 'reload schema';