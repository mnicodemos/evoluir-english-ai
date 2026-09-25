# Fase 6A — Benchmark Lovable AI × Google

## Objetivo
Consolidar um benchmark somente leitura na aba existente **Custo & Performance**, usando eventos e caches já existentes, sem alterar qualquer operação de IA ou regra do produto.

## Implementação
- Reutilizar `ai_usage_events` para agrupar operação × modelo e calcular chamadas, sucesso/erro, timeouts/cancelamentos, tokens com cobertura, duração média, mediana e p95 somente com amostra suficiente.
- Reutilizar `ai_response_cache` para exibir entradas e HITs cumulativos; tratar cada evento de Dictionary como MISS de IA, pois HIT não chama `reserveAiUsage`; não calcular taxa por período quando HITs são apenas cumulativos.
- Corrigir a apresentação de provider para refletir o caminho real auditado e sinalizar casos em que o modelo gravado não identifica o provider efetivo, especialmente Transcription e histórico antigo de AI Talking.
- Exibir custos e projeções somente quando cada registro tiver custo atribuível; manter créditos Lovable, first token/chunk/audio, duração de streaming, retries e fallback como **N/D** onde não há medição confiável.
- Adicionar filtros simples de período, operação e provider/modelo na aba existente, sem alterar Usuários ou Consumo IA.
- Incluir classificação visível **Observado / Calculado / Estimado / N/D**, limitações da amostra e ausência de ranking ou “vencedor”.

## Amostra
- Usar os eventos reais já existentes dos últimos 30 dias. Há amostra superior a 10 chamadas para AI Teacher, AI Talking, Transcription, TTS, Vocabulary, Writing e Lesson Generation; Dictionary tem 8 e Quiz 3.
- Não executar novas chamadas: isso consumiria quotas/créditos e poderia alterar progresso real. A limitação de Dictionary e Quiz será explicitada.
- Usar os logs existentes do Lovable AI apenas como evidência no relatório final; como eles não são consultáveis pela aplicação com atribuição segura à operação, créditos por operação permanecem N/D no painel.

## Restrições preservadas
- Sem provider/modelo/prompt/fallback/retry/timeout/quota/limite/cache/concorrência alterados.
- Sem mudança em Vocabulary, Pronunciation, pedagogia, score, CEFR, auth, billing ou dados de alunos.
- Sem tabela, coluna ou migration nova.
- Sem Fase 6B ou decisão arquitetural.

## Validação
- Testes unitários das agregações, incluindo mediana/p95, cobertura parcial, erros e N/D.
- TypeScript, lint, suíte existente e build automático.
- Admin protegido e as três abas verificadas em mobile e desktop.
- Relatório final com as 27 evidências solicitadas e créditos consumidos nesta implementação.
