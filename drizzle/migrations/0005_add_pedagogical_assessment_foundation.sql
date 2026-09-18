CREATE TABLE public.assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_type text NOT NULL CHECK (assessment_type IN ('placement','diagnostic','progress_check','final')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','abandoned','invalidated')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  ruleset_version text NOT NULL,
  rubric_version text NOT NULL,
  overall_score numeric(5,2) CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  overall_cefr text CHECK (overall_cefr IS NULL OR overall_cefr IN ('A1','A2','B1','B2','C1','C2','insufficient_evidence')),
  overall_confidence numeric(4,3) CHECK (overall_confidence IS NULL OR (overall_confidence >= 0 AND overall_confidence <= 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_sessions_completion_consistency CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status <> 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT assessment_sessions_insufficient_result CHECK (
    overall_cefr IS DISTINCT FROM 'insufficient_evidence' OR
    (overall_score IS NULL AND overall_confidence IS NULL)
  ),
  CONSTRAINT assessment_sessions_id_user_unique UNIQUE (id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.assessment_sessions TO authenticated;
GRANT ALL ON public.assessment_sessions TO service_role;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assessment sessions"
ON public.assessment_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assessment sessions"
ON public.assessment_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assessment sessions"
ON public.assessment_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
CREATE INDEX assessment_sessions_user_started_idx
ON public.assessment_sessions (user_id, started_at DESC);
CREATE INDEX assessment_sessions_user_status_idx
ON public.assessment_sessions (user_id, status, created_at DESC);
CREATE TRIGGER assessment_sessions_updated_at
BEFORE UPDATE ON public.assessment_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.assessment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (skill IN ('grammar','vocabulary','reading','listening','writing','speaking','pronunciation')),
  subskill text,
  source_type text NOT NULL CHECK (source_type IN ('placement','quiz','writing','speaking','listening','pronunciation','vocabulary','reading','final_test')),
  source_id uuid,
  item_cefr text CHECK (item_cefr IS NULL OR item_cefr IN ('A1','A2','B1','B2','C1','C2')),
  raw_score numeric(5,2) NOT NULL CHECK (raw_score >= 0 AND raw_score <= 100),
  source_reliability numeric(4,3) NOT NULL CHECK (source_reliability >= 0 AND source_reliability <= 1),
  evidence_quality numeric(4,3) NOT NULL CHECK (evidence_quality >= 0 AND evidence_quality <= 1),
  sample_weight numeric(8,3) NOT NULL DEFAULT 1 CHECK (sample_weight > 0),
  evaluated_by text NOT NULL CHECK (evaluated_by IN ('deterministic','gemini','hybrid')),
  model_version text,
  rubric_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_evidence_session_owner_fkey
    FOREIGN KEY (assessment_session_id, user_id)
    REFERENCES public.assessment_sessions(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT assessment_evidence_id_user_unique UNIQUE (id, user_id)
);
GRANT SELECT, INSERT ON public.assessment_evidence TO authenticated;
GRANT ALL ON public.assessment_evidence TO service_role;
ALTER TABLE public.assessment_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assessment evidence"
ON public.assessment_evidence FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assessment evidence"
ON public.assessment_evidence FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE INDEX assessment_evidence_session_created_idx
ON public.assessment_evidence (assessment_session_id, created_at);
CREATE INDEX assessment_evidence_user_skill_created_idx
ON public.assessment_evidence (user_id, skill, created_at DESC);
CREATE INDEX assessment_evidence_source_idx
ON public.assessment_evidence (source_type, source_id)
WHERE source_id IS NOT NULL;

CREATE TABLE public.assessment_skill_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (skill IN ('grammar','vocabulary','reading','listening','writing','speaking','pronunciation')),
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  cefr_level text NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2','insufficient_evidence')),
  confidence_score numeric(4,3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  rule_version text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_skill_results_session_owner_fkey
    FOREIGN KEY (assessment_session_id, user_id)
    REFERENCES public.assessment_sessions(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT assessment_skill_results_session_skill_unique
    UNIQUE (assessment_session_id, skill),
  CONSTRAINT assessment_skill_results_evidence_consistency CHECK (
    (cefr_level = 'insufficient_evidence' AND score IS NULL AND confidence_score IS NULL) OR
    (cefr_level <> 'insufficient_evidence' AND score IS NOT NULL AND confidence_score IS NOT NULL AND evidence_count > 0)
  )
);
GRANT SELECT, INSERT ON public.assessment_skill_results TO authenticated;
GRANT ALL ON public.assessment_skill_results TO service_role;
ALTER TABLE public.assessment_skill_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assessment skill results"
ON public.assessment_skill_results FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assessment skill results"
ON public.assessment_skill_results FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE INDEX assessment_skill_results_user_skill_assessed_idx
ON public.assessment_skill_results (user_id, skill, assessed_at DESC);

CREATE VIEW public.current_skill_profile
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (result.user_id, result.skill)
  result.user_id,
  result.skill,
  result.score,
  result.cefr_level,
  result.confidence_score,
  result.evidence_count,
  result.rule_version,
  result.assessed_at,
  result.assessment_session_id
FROM public.assessment_skill_results AS result
JOIN public.assessment_sessions AS session
  ON session.id = result.assessment_session_id
 AND session.user_id = result.user_id
WHERE session.status = 'completed'
ORDER BY result.user_id, result.skill, result.assessed_at DESC, result.created_at DESC, result.id DESC;
GRANT SELECT ON public.current_skill_profile TO authenticated;
GRANT SELECT ON public.current_skill_profile TO service_role;

ALTER TABLE public.learning_errors
ADD COLUMN assessment_session_id uuid,
ADD COLUMN assessment_evidence_id uuid;
ALTER TABLE public.learning_errors
ADD CONSTRAINT learning_errors_assessment_session_owner_fkey
FOREIGN KEY (assessment_session_id, user_id)
REFERENCES public.assessment_sessions(id, user_id)
ON DELETE SET NULL;
ALTER TABLE public.learning_errors
ADD CONSTRAINT learning_errors_assessment_evidence_owner_fkey
FOREIGN KEY (assessment_evidence_id, user_id)
REFERENCES public.assessment_evidence(id, user_id)
ON DELETE SET NULL;
CREATE INDEX learning_errors_assessment_session_idx
ON public.learning_errors (assessment_session_id)
WHERE assessment_session_id IS NOT NULL;
CREATE INDEX learning_errors_assessment_evidence_idx
ON public.learning_errors (assessment_evidence_id)
WHERE assessment_evidence_id IS NOT NULL;