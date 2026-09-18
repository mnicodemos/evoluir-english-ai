ALTER TABLE public.quizzes
ADD COLUMN pedagogical_skill text;
ALTER TABLE public.quizzes
ADD CONSTRAINT quizzes_pedagogical_skill_check
CHECK (pedagogical_skill IS NULL OR pedagogical_skill IN ('grammar','vocabulary'));

ALTER TABLE public.assessment_sessions
ADD COLUMN source_type text,
ADD COLUMN source_id uuid,
ADD COLUMN idempotency_key text;
ALTER TABLE public.assessment_sessions
ADD CONSTRAINT assessment_sessions_source_type_check
CHECK (source_type IS NULL OR source_type IN ('quiz','writing'));
CREATE UNIQUE INDEX assessment_sessions_user_idempotency_uq
ON public.assessment_sessions (user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
CREATE INDEX assessment_sessions_source_idx
ON public.assessment_sessions (user_id, source_type, source_id)
WHERE source_id IS NOT NULL;

ALTER TABLE public.assessment_evidence
ADD COLUMN evidence_type text,
ADD COLUMN polarity text,
ADD COLUMN source_item_id uuid,
ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.assessment_evidence
ADD CONSTRAINT assessment_evidence_type_check
CHECK (evidence_type IS NULL OR evidence_type IN ('answer','subscore'));
ALTER TABLE public.assessment_evidence
ADD CONSTRAINT assessment_evidence_polarity_check
CHECK (polarity IS NULL OR polarity IN ('positive','negative','neutral'));
ALTER TABLE public.assessment_evidence
ADD CONSTRAINT assessment_evidence_metadata_object_check
CHECK (jsonb_typeof(metadata) = 'object');
CREATE UNIQUE INDEX assessment_evidence_source_signal_uq
ON public.assessment_evidence (
  user_id,
  source_type,
  source_id,
  COALESCE(source_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
  skill,
  COALESCE(subskill, ''),
  COALESCE(evidence_type, '')
)
WHERE source_id IS NOT NULL;

CREATE TABLE public.writing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  prompt text NOT NULL CHECK (char_length(prompt) <= 2000),
  original_text text NOT NULL CHECK (char_length(original_text) BETWEEN 1 AND 12000),
  corrected_text text NOT NULL CHECK (char_length(corrected_text) BETWEEN 1 AND 12000),
  natural_text text NOT NULL CHECK (char_length(natural_text) BETWEEN 1 AND 12000),
  explanations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(explanations) = 'array'),
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(suggestions) = 'array'),
  grammar_score numeric(5,2) NOT NULL CHECK (grammar_score BETWEEN 0 AND 100),
  vocabulary_score numeric(5,2) NOT NULL CHECK (vocabulary_score BETWEEN 0 AND 100),
  clarity_score numeric(5,2) NOT NULL CHECK (clarity_score BETWEEN 0 AND 100),
  model_version text NOT NULL,
  rubric_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_submissions_user_id_unique UNIQUE (id, user_id),
  CONSTRAINT writing_submissions_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);
GRANT SELECT, INSERT ON public.writing_submissions TO authenticated;
GRANT ALL ON public.writing_submissions TO service_role;
ALTER TABLE public.writing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own writing submissions"
ON public.writing_submissions FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own writing submissions"
ON public.writing_submissions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE INDEX writing_submissions_user_created_idx
ON public.writing_submissions (user_id, created_at DESC);

CREATE TABLE public.pedagogical_dual_write_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('quiz','writing')),
  source_id uuid,
  idempotency_key text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('source','session','evidence','aggregation','completion')),
  error_code text NOT NULL CHECK (char_length(error_code) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT pedagogical_dual_write_failures_user_key_unique UNIQUE (user_id, idempotency_key)
);
GRANT SELECT, INSERT, UPDATE ON public.pedagogical_dual_write_failures TO authenticated;
GRANT ALL ON public.pedagogical_dual_write_failures TO service_role;
ALTER TABLE public.pedagogical_dual_write_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pedagogical dual write failures"
ON public.pedagogical_dual_write_failures FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pedagogical dual write failures"
ON public.pedagogical_dual_write_failures FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pedagogical dual write failures"
ON public.pedagogical_dual_write_failures FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
CREATE INDEX pedagogical_dual_write_failures_pending_idx
ON public.pedagogical_dual_write_failures (user_id, last_failed_at)
WHERE status = 'pending';