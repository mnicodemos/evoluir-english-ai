# Fase 2I — Observabilidade operacional e pedagógica

## Resultado esperado

Adicionar uma trilha estruturada, append-only e segura para Quiz, Writing, Dual Write e retries, sem transformar logs em fonte de verdade e sem alterar scoring, CEFR, confidence, aprovação, conteúdo, UX, idempotência, retry, persistência legada ou autoridade server-side.

## Gates já auditados

- 64/64 testes existentes aprovados; typecheck, build e lint relevante aprovados.
- Migrations 0008–0016 e seus efeitos confirmados no schema ativo.
- 30/30 questões têm `pedagogical_skill`; `MISSING_PEDAGOGICAL_MAPPING` está ativo.
- `correct_answer` permanece indisponível a usuários comuns.
- Escritas diretas em `activities` e `progress` continuam bloqueadas.
- RPCs privilegiadas são `SECURITY DEFINER` e executáveis somente por `service_role`.
- RLS de leitura própria está ativo nas tabelas operacionais e pedagógicas.
- Baseline: quiz_results 10; writing_submissions 1; activities 70; progress 63; sessions 3; evidence 23; skill_results 5; dual_write_failures 0; learning_errors 0.

## Implementação

### 1. Armazenamento mínimo e seguro

Criar uma migration aditiva com uma tabela `operation_observability_events` contendo:

- identidade: `event_id`, `user_id`, `operation_type`, `operation_key`, `correlation_id`;
- evento: `event_name`, `stage`, `status`, `occurred_at`, `duration_ms`, `attempt_number`;
- falha/retry: `failure_code`, `retryable`, `previous_status`, `new_status`, `next_retry_at`;
- referências opcionais: `lesson_id`, `submission_id`, `quiz_result_id`, `activity_id`, `assessment_session_id`, `source_item_id`;
- metadados mínimos e sanitizados, sem texto de redação, respostas, gabarito, prompts internos, tokens ou PII desnecessária.

Aplicar índices por usuário/operação/data/status, RLS com `SELECT` somente do próprio usuário, ausência de INSERT/UPDATE/DELETE para `anon` e `authenticated`, `ALL` para `service_role`, e uma RPC `record_operation_observability_event` executável somente por `service_role`. Eventos serão imutáveis e append-only para usuários finais.

### 2. Núcleo de instrumentação

Criar um módulo compartilhado com:

- contratos fechados para nomes de evento, stages e status;
- cronômetro monotônico em milissegundos;
- correlação usando o `attemptKey` do Quiz ou `operationKey` do Writing, sem nova identidade concorrente;
- sanitização por allowlist de metadados;
- gravação best-effort: falha de observabilidade é registrada no log técnico, mas nunca desfaz nem altera a operação funcional.

### 3. Quiz e Writing

Instrumentar os pontos já existentes, respeitando a ordem real atual:

- Quiz: `QUIZ_START`, `QUIZ_AUTHORIZED`, `QUIZ_EVALUATED`, `QUIZ_RESULT_PERSISTED`, `QUIZ_PEDAGOGICAL_PERSISTED`, `QUIZ_LEGACY_PERSISTED`, `QUIZ_COMPLETED`, `QUIZ_FAILED`.
- Writing: `WRITING_START`, `WRITING_AUTHORIZED`, `WRITING_EVALUATED`, `WRITING_RESULT_PERSISTED`, `WRITING_PEDAGOGICAL_PERSISTED`, `WRITING_LEGACY_PERSISTED`, `WRITING_COMPLETED`, `WRITING_FAILED`.
- Idempotência: `IDEMPOTENCY_REUSED` e `IDEMPOTENCY_CONFLICT`, incluindo concorrência, sem mudar a decisão atual.
- A conclusão ponta a ponta será registrada pela persistência legada, última etapa funcional hoje; uma operação interrompida antes dela ficará diagnosticável como “sem evento de conclusão”.
- Falhas pedagógicas continuam toleradas operacionalmente e recebem evento com stage/código/retryable; `MISSING_PEDAGOGICAL_MAPPING` inclui somente IDs técnicos da questão e lição.

### 4. Retry

Instrumentar o mecanismo existente sem alterar claim, ownership, stale timeout, backoff, retryability ou limite:

- `RETRY_SCHEDULED` após falha persistida como pendente;
- `RETRY_CLAIMED` após claim atômico;
- `RETRY_COMPLETED` após resolução;
- `RETRY_FAILED` quando retorna a pendente;
- `RETRY_EXHAUSTED` quando termina em falha definitiva.

Registrar attempt number, estados anterior/final, failure code e `next_retry_at` quando disponíveis.

### 5. Métricas e diagnósticos somente leitura

Criar uma função autenticada, sem nova tela, que retorne apenas dados do usuário atual:

- totais, sucessos, falhas, retries e conflitos;
- métricas por Quiz/Writing e duração por etapa/operação;
- sessões, evidências, skill results e falhas de mapeamento;
- diagnósticos: resultado sem activity, resultado sem sessão, sessão sem evidence, evidence sem skill result aplicável, Writing sem activity/progress aplicável, retry inconsistente e operação observada sem conclusão.

As consultas serão diagnósticas: sem correção automática, exclusão ou recálculo.

### 6. Testes

Adicionar testes para:

- contratos, correlação, duração e sanitização;
- sucesso/falha de Quiz e Writing;
- idempotência reutilizada e conflitante;
- retry scheduled/claimed/completed/failed/exhausted;
- `MISSING_PEDAGOGICAL_MAPPING` sem evidência inventada;
- usuário sem INSERT/UPDATE/DELETE em eventos e sem leitura de outro usuário;
- ausência de `correct_answer`, respostas, tokens e texto integral nos eventos;
- diagnósticos de órfãos e ausência de duplicação.

Reexecutar todos os testes anteriores + novos, typecheck, build, lint dos arquivos alterados e verificações de autorização reais.

### 7. Validação real controlada

Somente após todos os gates estruturais:

1. Registrar novo baseline.
2. Executar exatamente 1 Quiz real pela interface normal.
3. Confirmar trilha completa e ausência de conteúdo sensível.
4. Se o Quiz for íntegro, executar exatamente 1 Writing real pela interface normal.
5. Confirmar trilha completa, latências, referências e ausência de duplicação.
6. Comparar baseline/final; somente os registros legítimos das duas operações e seus eventos podem variar.
7. Validar isolamento dinamicamente se houver segundo usuário; caso contrário, registrar a limitação e comprovar RLS/ownership estruturalmente.

Qualquer gate crítico quebrado interrompe as operações reais e classifica a fase como `NEEDS CORRECTION` ou `BLOCKED`.

## Escopo preservado

Nenhuma alteração em UX, scores, aprovação de 70%, CEFR, confidence, perguntas, respostas, prompts, progress, activities, regras pedagógicas, Writing funcional, novos skills, Speaking, Listening, Pronunciation ou AI Talking.
