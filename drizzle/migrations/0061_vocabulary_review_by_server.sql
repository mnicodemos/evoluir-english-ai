-- Security audit item 3 (2026-10-10): vocabulary reviews are written only by
-- the server (reviewVocabularyWord / resetVocabularyWords in
-- src/lib/vocabularyReview.functions.ts), which applies the spaced review
-- ladder. Reviewed words complete a study day in credit_study_day, so the
-- browser can no longer invent reviews or skip steps.
-- Apply AFTER the app version that saves reviews on the server is published.
-- Idempotent: REVOKE and GRANT can run more than once.

REVOKE INSERT, UPDATE, DELETE ON public.user_vocabulary FROM anon, authenticated;
GRANT SELECT ON public.user_vocabulary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vocabulary TO service_role;

NOTIFY pgrst, 'reload schema';
