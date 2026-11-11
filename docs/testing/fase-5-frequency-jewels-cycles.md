# Fase 5 — Validação dos ciclos de frequência e joias

## Objetivo

Ampliar a validação automatizada das regras já existentes de streak e joias permanentes, cobrindo checkpoints de 4, 8 e 12 semanas. Esta fase é somente de testes: não altera regras de negócio, migrations, dados de alunos ou ambiente de produção.

## Regras preservadas

- Frequência semanal segue o Modelo A: `min(C válido, D) / D`. Dias válidos excedentes permanecem no histórico.
- Streak continua sendo uma métrica separada da frequência semanal.
- Marcos permanentes permanecem em 1, 7, 14, 21, 28, 35, 42, 49, 56 e 63 dias.
- Ciclos Diamond adicionais permanecem em 126, 189, 252… dias.
- Freeze continua protegendo no máximo um dia perdido por semana (segunda a domingo, fuso America/Sao_Paulo), sem criar dia artificial em `study_days`.
- Reset do streak não remove joias nem ciclos já concedidos.

## Cobertura adicionada

| Cenário | Streak | Resultado esperado |
|---|---:|---|
| F5-04 | 28 dias (4 semanas) | 5 joias, até Ruby |
| F5-08 | 56 dias (8 semanas) | 9 joias, até Obsidian |
| F5-12 | 84 dias (12 semanas) | 10 joias, incluindo Diamond |
| F5-DIA | 28/56/84 dias | Nenhum ciclo Diamond adicional antes de 126 |
| F5-PERM | Repetição e reset após 84 dias | As 10 joias permanecem sem duplicação |

Os cenários são executados no PostgreSQL efêmero do workflow de integração da Fase 4, aplicando as migrations reais 0090 e 0099.

## Limite conhecido da fixture

A fixture PostgreSQL atual é intencionalmente mínima e aplica somente as migrations 0090 e 0099. Portanto, os cenários SQL desta fase validam os marcos de streak, permanência e ciclos Diamond; não simulam a função completa `credit_study_day` nem comprovam o consumo de freeze ponta a ponta. A regra de freeze permanece coberta pelos testes unitários de `streakFreeze` e deverá receber integração própria somente quando a fixture incluir, de forma isolada, todas as dependências reais dessa função.

## Segurança e rollout

- Nenhuma migration nova.
- Nenhuma alteração no runtime ou na UI.
- Nenhuma gravação em banco de produção.
- Nenhum backfill.
- Nenhuma mudança em XP, Weekly League ou sincronização.
- Merge somente após CI verde e revisão do diff.
