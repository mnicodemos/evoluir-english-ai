-- Vocabulary words belong to each student (created_by + level + batch), but
-- the original table kept a global UNIQUE (word): once any student (or the
-- same student at another level) owned a word, a new batch containing it
-- failed whole with "duplicate key value violates unique constraint
-- vocabulary_word_key". The global rule is dropped; the server already skips
-- words the student owns at that level. Idempotent.

ALTER TABLE public.vocabulary DROP CONSTRAINT IF EXISTS vocabulary_word_key;
DROP INDEX IF EXISTS public.vocabulary_word_key;

NOTIFY pgrst, 'reload schema';
