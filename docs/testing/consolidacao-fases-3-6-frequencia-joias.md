# Consolidação das Fases 3–6 — Frequência e Joias

Data: 2026-11-11  
Status: consolidação documental; não altera regras, runtime, schema ou dados de alunos.

## Objetivo

Registrar em um único lugar o estado verificável das regras de frequência semanal, streak, Freeze e joias permanentes, evitando repetir validações já integradas e distinguindo testes de CI de validações no ambiente Lovable Cloud.

## Estado consolidado

| Fase | Escopo | Estado | Evidência |
|---|---|---|---|
| 1 | Auditoria e separação dos conceitos | Concluída | `docs/product/permanent-jewels-audit.md` |
| 2 | Regras de frequência, streak, Freeze e joias | Consolidada | `docs/product/weekly-frequency-model-a.md`; migrations 0038/0042/0090/0099 |
| 3 | Implementação das regras persistidas | Implementada no repositório | migrations 0038, 0042, 0090 e 0099; gatilhos PostgreSQL |
| 4 | Integração PostgreSQL de joias e Freeze | Concluída no CI | PR #991 e PR #1001; workflow PostgreSQL efêmero aprovado |
| 5 | Checkpoints de progressão | Concluída no CI | PR #993; assertions para 28, 56 e 84 dias |
| 6 | Encerramento e confirmação operacional | Em aberto | depende das verificações operacionais listadas abaixo |

## Regras que permanecem vigentes

### Frequência semanal — Modelo A

Para alvo semanal D e C datas distintas qualificadas na semana de segunda a domingo:

- Crédito semanal: `min(C, D)`.
- Progresso: `min(C, D) / D`.
- A meta é atingida quando `C >= D`.
- Dias qualificados excedentes continuam no histórico, sem crédito adicional.
- Frequência semanal não é streak. Atividade fora dos dias planejados pode contribuir para a meta sem alterar a seleção salva de dias.

### Streak, Freeze e joias

- Freeze protege no máximo um dia perdido por semana (segunda a domingo, `America/Sao_Paulo`).
- Freeze não cria linha artificial em `study_days`.
- Marcos permanentes: Bronze 1; Silver 7; Gold 14; Sapphire 21; Ruby 28; Emerald 35; Amethyst 42; Pearl 49; Obsidian 56; Diamond 63 dias.
- Ciclos Diamond adicionais: 126, 189, 252… dias.
- Concessões são idempotentes e permanecem após reset do streak.
- Rollback transacional reverte conjuntamente a atualização do streak e as concessões correspondentes.

XP e Weekly League permanecem independentes dessas regras.

## Evidências integradas

- **PR #991:** testes PostgreSQL de integração para joias e ciclos, usando banco descartável.
- **PR #993:** validação de checkpoints de 4, 8 e 12 semanas; 28 dias = 5 joias, 56 = 9, 84 = 10; sem ciclo Diamond antes de 126 dias.
- **PR #1001:** Freeze ponta a ponta em PostgreSQL, limite semanal, ausência de dia artificial em `study_days` e rollback atômico.
- **PR #990:** implementação do Modelo A de frequência semanal.
- **PR #994:** cobertura adicional dos alvos semanais 1, 2, 3, 5 e 7 dias.

Os PRs acima foram verificados como integrados no GitHub. Os workflows associados aos PRs #993 e #1001 foram verificados como concluídos com sucesso. Isso comprova a execução no CI isolado, não a aplicação de migrations nem a validação de dados no ambiente de produção.

## Distinção importante: joias por streak e proposta pedagógica

As migrations 0090 e 0099 implementam a concessão atual das joias pelos marcos de streak. Os documentos `permanent-jewels-implementation-contract.md` e `permanent-jewels-rule-matrix-draft.md` descrevem uma proposta separada de conquistas pedagógicas baseada em evidências de aprendizagem, ainda marcada como proposta.

Não misturar os dois modelos nem substituir os marcos atuais por critérios pedagógicos sem decisão explícita de produto. Esta consolidação não aprova nem implementa uma nova ledger pedagógica.

## Pendências para a Fase 6

1. Confirmar no Lovable Cloud se as migrations relevantes estão aplicadas e se as funções/triggers correspondentes estão presentes. Não inferir isso a partir do CI.
2. Validar leitura das joias, estado do Freeze e histórico com conta de teste autorizada, sem alterar dados reais de alunos.
3. Registrar evidências operacionais (ambiente, data, resultado e escopo) e fechar a fase somente após essas confirmações.
4. Manter a matriz pedagógica como proposta até aprovação explícita de critérios e eventual escopo próprio.

## Fora do escopo desta consolidação

- Nenhuma migration, tabela, RPC, trigger ou alteração de runtime/UI.
- Nenhuma mudança em streak, Freeze, frequência, XP ou Weekly League.
- Nenhum backfill, concessão retroativa ou alteração de dados de produção.
- Nenhuma repetição dos testes já aprovados em CI, salvo regressão ou evidência de falha.

## Critério de encerramento

A Fase 6 poderá ser marcada como concluída quando as verificações operacionais acima forem registradas. Até lá, as Fases 4 e 5 permanecem concluídas por CI e a Fase 6 permanece operacionalmente pendente.
