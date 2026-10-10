# Pendências na Lovable (09/10/2026)

Faça **nesta ordem**. Cada migration pode rodar mais de uma vez sem problema.

## 1. Publicar

Clique em **Publish** na Lovable para colocar no ar a versão atual do `main`
(PRs #166 e #167 em diante). **Faça isto antes das migrations 0058 e 0059**:
sem a nova versão, abrir e concluir lições fica bloqueado.

## 2. Rodar as migrations no chat da Lovable

Cole no chat da Lovable, uma de cada vez (ou todas juntas), pedindo:

> Rode este SQL no banco, exatamente como está.

Cada bloco já termina com `NOTIFY pgrst, 'reload schema';`.

| Migration | O que faz                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------- |
| 0056      | Cada aluno tem suas próprias palavras de vocabulário (fim do erro "duplicate key vocabulary_word_key"). |
| 0057      | Uma conversa concluída com a EVO também completa o dia de estudo.                                       |
| 0058      | Só o servidor grava lições, quizzes e cartões (ninguém forja um Teste Final).                           |
| 0059      | Só o servidor marca lição como concluída (a partir do quiz corrigido).                                  |
| 0060      | A checagem de Premium só responde sobre a própria conta.                                                |

### 0056_vocabulary_word_per_student.sql

```sql
-- Vocabulary words belong to each student (created_by + level + batch), but
-- the original table kept a global UNIQUE (word): once any student (or the
-- same student at another level) owned a word, a new batch containing it
-- failed whole with "duplicate key value violates unique constraint
-- vocabulary_word_key". The global rule is dropped; the server already skips
-- words the student owns at that level. Idempotent.

ALTER TABLE public.vocabulary DROP CONSTRAINT IF EXISTS vocabulary_word_key;
DROP INDEX IF EXISTS public.vocabulary_word_key;

NOTIFY pgrst, 'reload schema';
```

### 0057_study_day_conversation.sql

```sql
-- Study streak (user decision): one finished conversation with EVO (AI
-- Speaking or the video call, with its report: activity_type 'conversation')
-- also completes the day, next to a lesson, 3 Writing corrections, 3 Listening
-- sessions, 10 reviewed words or every Goals step of the day. Idempotent.

CREATE OR REPLACE FUNCTION public.credit_study_day(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_missed date := v_today - 1;
  v_profile public.profiles%ROWTYPE;
  v_ok boolean;
  v_frozen boolean;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.last_activity_date = v_today THEN RETURN; END IF;

  v_ok :=
    (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'writing'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'listening'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 3
    OR (SELECT count(*) FROM public.user_vocabulary
       WHERE user_id = p_user_id AND last_reviewed_at IS NOT NULL
         AND (last_reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today) >= 10
    OR EXISTS (SELECT 1 FROM public.activities
       WHERE user_id = p_user_id AND activity_type = 'conversation'
         AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR EXISTS (SELECT 1 FROM public.user_lessons
       WHERE user_id = p_user_id AND completed_at IS NOT NULL
         AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today)
    OR (EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today)
        AND NOT EXISTS (SELECT 1 FROM public.plus_goal_steps
          WHERE user_id = p_user_id AND day = v_today AND done_at IS NULL));

  IF v_ok THEN
    -- Exactly one day missed, and no protection used yet in that day's week.
    v_frozen := v_profile.last_activity_date = v_today - 2
      AND v_profile.streak_days > 0
      AND (v_profile.streak_freeze_used_on IS NULL
           OR v_profile.streak_freeze_used_on < date_trunc('week', v_missed)::date);

    UPDATE public.profiles
    SET streak_days = CASE
          WHEN last_activity_date = v_missed OR v_frozen THEN streak_days + 1
          ELSE 1
        END,
        streak_freeze_used_on = CASE WHEN v_frozen THEN v_missed ELSE streak_freeze_used_on END,
        last_activity_date = v_today
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_study_day(uuid) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_study_day_activities ON public.activities;
CREATE TRIGGER credit_study_day_activities
AFTER INSERT ON public.activities
FOR EACH ROW WHEN (NEW.activity_type IN ('writing','listening','conversation'))
EXECUTE FUNCTION public.credit_study_day_trigger();

NOTIFY pgrst, 'reload schema';
```

### 0058_content_written_by_server_only.sql

```sql
-- Security audit (2026-10-09): lessons, quizzes and flashcards are written only
-- by the server with the service role (contentWriter in
-- src/lib/curriculumContent.server.ts). A student's own session could insert a
-- lesson with a Final Test key and quiz rows whose answers it chose, then pass
-- the test; students now only read these tables.
-- Apply AFTER the app version that writes with the service role is published.
-- Idempotent: REVOKE and GRANT can run more than once.

REVOKE INSERT, UPDATE, DELETE ON public.lessons FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quizzes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.flashcards FROM anon, authenticated;
-- Column-level INSERT on quizzes (migration 0028) is a separate privilege.
REVOKE INSERT (id, lesson_id, question, question_type, options, correct_answer, explanation, sort_order, created_at, created_by, pedagogical_skill)
  ON public.quizzes FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO service_role;

NOTIFY pgrst, 'reload schema';
```

### 0059_lesson_completion_by_server.sql

```sql
-- Security audit (2026-10-09): a lesson is completed only by the server
-- (completeLessonFromQuiz, from the quiz result it graded). The browser keeps
-- writing the video progress of its own rows (RLS still limits it to them),
-- but can no longer set completed_at/progress, change which lesson a row is
-- for, or delete rows.
-- Apply AFTER the app version that completes lessons on the server is published.
-- Idempotent: REVOKE and GRANT can run more than once.

REVOKE INSERT, UPDATE, DELETE ON public.user_lessons FROM anon, authenticated;
GRANT INSERT (user_id, lesson_id, video_progress, video_completed_at)
  ON public.user_lessons TO authenticated;
GRANT UPDATE (video_progress, video_completed_at)
  ON public.user_lessons TO authenticated;
GRANT SELECT ON public.user_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lessons TO service_role;

NOTIFY pgrst, 'reload schema';
```

### 0060_entitlement_check_own_account.sql

```sql
-- Security audit (2026-10-09): has_active_entitlement answers only for the
-- caller's own account (or the server's service role), like has_role since
-- migration 0029, so a student cannot ask whether another account is Premium.
-- The server (service role) and reserve_ai_usage keep working unchanged.
-- Idempotent: CREATE OR REPLACE and GRANT can run more than once.

CREATE OR REPLACE FUNCTION public.has_active_entitlement(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR auth.uid() = _user_id THEN EXISTS (
      SELECT 1
      FROM public.entitlements
      WHERE user_id = _user_id
        AND feature = _feature
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.has_active_entitlement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_entitlement(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
```

## 3. Conferir

- Abra uma lição nova e conclua o quiz com 70% ou mais: ela deve aparecer como concluída.
- Gere as palavras do dia no Vocabulário: o lote deve vir completo.
- Admin → Custo & Performance: em alguns dias, Transcrição e TTS passam a mostrar custo medido.

## 4. Fora do código (com você)

- **Preço do TTS e da transcrição**: conferidos no faturamento em 10/10 (batem com o app).
- **Lovable AI**: o app não usa mais a IA da Lovable; não é preciso comprar créditos dela.
  As chamadas ao Gemini seguem pelo conector da Lovable com a sua chave.
- **Regras do banco (opcional, para eu conferir)**: peça no chat da Lovable para rodar e me cole o resultado:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;
```

## 5. Migração 0061 (vocabulário pelo servidor)

Depois de **publicar** a versão que grava as revisões do vocabulário pelo servidor,
cole no chat da Lovable:

> Rode a migração `drizzle/migrations/0061_vocabulary_review_by_server.sql` e depois
> `NOTIFY pgrst, 'reload schema'`.

Conferir: no Vocabulário, marque "Eu sei" numa palavra nova e pronuncie outra com 70% ou mais;
as duas devem avançar sem mensagem de erro.
