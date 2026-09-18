# Fase 2F-L2 — autoridade server-side da camada legada

## Auditoria concluída

| Módulo | Fonte bruta atual | Score calculado hoje | Persistência atual | Fonte autoritativa atual | Identidade |
|---|---|---|---|---|---|
| Quiz | `lessonId`, IDs das questões e respostas | Servidor, por `gradeQuizAnswers` e gabarito protegido | `quiz_results` e Dual Write no servidor; `activities` no cliente | `quiz_results` | `attemptKey` existente |
| Writing | prompt e texto original | Servidor/Gemini, validado e salvo | `writing_submissions` e Dual Write no servidor; `activities` e `progress.writing_score` no cliente | `writing_submissions` | `operationKey` existente |
| Listening | frase-alvo e transcrição produzida pelo endpoint autenticado | Navegador, por correspondência de palavras (`hits / palavras-alvo`), 70%, até 3 tentativas | `activities` e `progress.listening_score` no cliente; andamento local | Inexistente para o resultado final | nova chave estável por rodada |
| Vocabulary | palavra cadastrada e transcrição | Navegador | `activities` e `progress.reading_score` no cliente | Inexistente para o resultado final | nova chave estável por tentativa |
| Pronunciation | É a prática dentro de Vocabulary; palavra cadastrada e transcrição | Navegador, mesma distância de Levenshtein normalizada atual; mensagens em 80% e 55% | Mesmo fluxo de Vocabulary | Inexistente | mesma chave de Vocabulary |
| AI Talking | cenário e mensagens transcritas da conversa | Gemini chamado pelo servidor, mas resultado volta à tela antes da persistência | `activities` e `progress.speaking_score` no cliente; `learning_profile` também é atualizado no cliente | Resposta efêmera do Gemini, não persistida | nova chave estável por conversa |
| Lições | resultado do Quiz autoritativo e tempo bruto | Quiz no servidor | conclusão em `user_lessons` e `activities` no cliente | `quiz_results` | `attemptKey` |
| Final Test | resultado do Quiz autoritativo e tempo bruto | Quiz no servidor | `activities`, conclusão e promoção executadas pelo cliente | `quiz_results` | `attemptKey` |
| Tempo de prática | eventos de interação medidos no navegador | minutos arredondados no navegador | `activities` sem score via `logActivity` ao sair | telemetria bruta, não resultado avaliativo | nova chave por sessão de tela |

### Caminhos encontrados

- `logActivity` é o único caminho normal de insert em `activities` e `progress`; também atualiza streak no cliente.
- Listening envia score e `listening_score` calculados na tela.
- Vocabulary/Pronunciation envia score de similaridade e o grava atualmente em `reading_score`; essa semântica será preservada.
- AI Talking recebe o relatório do servidor, calcula a média na tela e envia apenas `fluency` para `speaking_score`; essa regra será preservada.
- Writing recalcula no navegador a média de grammar/vocabulary/clarity recebida do servidor.
- Quiz, lições e Final Test recebem score autoritativo, mas o reenviam pelo callback para persistência legada client-side.
- `resetAllProgress` contém deletes diretos, porém não possui chamadores; não será ativado nem ampliado nesta fase.
- `activities` e `progress` têm policy `ALL` para o proprietário e grants completos de `authenticated`; não possuem triggers.
- Estado inicial: 8 `quiz_results`, 0 `writing_submissions`, 1 sessão, 10 evidências, 1 resultado por habilidade, 0 falhas, 68 atividades e 62 snapshots de progresso. Apenas um usuário possui linhas legadas.

## Implementação

1. Criar contratos estritos para operações legadas. Nenhum contrato aceitará `score`, `is_correct`, `grammar_score`, `writing_score` ou qualquer nota por habilidade enviada pelo navegador.
2. Criar uma função server-side autenticada para persistência de telemetria sem score e operações avaliativas verificáveis.
3. Centralizar no servidor a regra legada existente: atividade deduplicada, nível lido do perfil, streak, e snapshot de progresso com `MAX` atômico por habilidade.
4. Quiz: após gravar/reutilizar `quiz_results`, persistir a atividade legada a partir da própria linha autoritativa. O cliente deixará de reenviar score.
5. Writing: após gravar/reutilizar `writing_submissions`, calcular a mesma média existente no servidor e persistir `activities`/`progress.writing_score` diretamente.
6. Listening: compartilhar a normalização/correspondência atual em código seguro, enviar frases e transcrições brutas, validar as frases contra o conjunto permitido da rodada e recalcular no servidor a mesma média já usada pela tela.
7. Vocabulary/Pronunciation: carregar a palavra pelo ID no servidor, receber somente a transcrição, aplicar exatamente a distância de Levenshtein atual e preservar a atualização histórica em `reading_score`.
8. AI Talking: criar finalização autoritativa que recebe a identidade, cenário e conversa bruta; o servidor chama o mesmo Gemini com o mesmo prompt/parser, persiste o resultado e retorna o relatório à tela. O navegador não enviará a avaliação.
9. Substituir `logActivity` por chamadas server-side sem campos derivados. Registros apenas de tempo continuarão como telemetria bruta, com tipos permitidos e duração limitada; não poderão criar conclusão nem score.
10. Adicionar identidade de operação às atividades e unicidade por usuário/módulo/chave, preservando histórico existente com colunas opcionais.
11. Revogar INSERT/UPDATE/DELETE de `authenticated` e `anon` em `activities` e `progress`; manter SELECT próprio por RLS e escrita total de `service_role`.
12. Preservar integralmente as tabelas, contratos e regras da fundação pedagógica; somente acoplar a persistência legada após os resultados autoritativos já existentes.

## Banco e atomicidade

- Migration `0014`: colunas de identidade/estado em `activities`, índice único parcial sem alterar linhas históricas, função transacional de persistência legada acessível somente ao servidor, grants mínimos e policies somente de leitura para o proprietário.
- A função transacional fará deduplicação, insert de atividade, atualização de streak e insert do snapshot de progresso sob lock, evitando corrida e duplicação.
- Nenhum histórico será apagado, reescrito ou recalculado.

## Validação sem operações reais

- Testes unitários dos algoritmos atuais de Listening e Pronunciation no servidor.
- Schemas estritos rejeitando scores forjados para todos os módulos.
- Testes de idempotência e conflito de identidade.
- Testes de que Quiz/Writing derivam a camada legada apenas das linhas autoritativas.
- Verificação de grants/RLS: escrita direta em `activities`/`progress` negada ao cliente e isolamento de leitura preservado.
- Testes existentes, testes novos, typecheck, lint apenas dos alterados e build de produção.
- Comparação das contagens antes/depois, sem Quiz real, Writing real ou qualquer operação real de aprendizagem.

## Limites preservados

- Nenhuma mudança visual, de conteúdo, das 20 questões, prompts, CEFR, confidence, agregação, Assessment ou fundação pedagógica.
- A promoção de nível do Final Test e `user_lessons` permanecem fora desta correção, pois o escopo autorizado é exclusivamente `activities`/`progress`; serão registrados como risco remanescente, sem alteração.
- A medição de minutos é telemetria bruta do navegador e não será tratada como nota; receberá allowlist, limites e idempotência, sem fabricar resultados avaliativos.
