# "I know it" com revisões espaçadas (Vocabulary)

Hoje, `markKnown` grava `mastery_level = 100` de uma vez, e a palavra passa a contar como aprendida para sempre. A proposta é que cada "I know it" avance a palavra **um degrau** numa escada de revisões: 1, 3, 7, 14 e 30 dias. Ela só vira "dominada" depois de passar pelas revisões.

## 1. Agendamento com os campos atuais e uma coluna nova

A escada usa os campos que já existem:

| Degrau | Próxima revisão | mastery_level |
|---|---|---|
| 0 (nunca marcada) | — | 0 |
| 1 | +1 dia | 20 |
| 2 | +3 dias | 40 |
| 3 | +7 dias | 60 |
| 4 | +14 dias | 75 |
| 5 | +30 dias | 90 |
| 6 (passou na revisão de 30 dias) | sem revisão | 100 |

- **mastery_level** guarda o degrau. Ele é a fonte da verdade, então não preciso de coluna para o degrau.
- **times_reviewed** continua sendo um contador. Ele não serve para calcular o degrau, porque outras ações também aumentam esse número.
- **last_reviewed_at** continua com a data da última revisão. O Streak depende desse campo (10 palavras revisadas no dia), e isso não muda.
- **is_difficult**: se o aluno erra a pronúncia ou toca em "Ainda não sei" numa revisão, a palavra volta 2 degraus (mínimo degrau 1) e recebe `is_difficult = true`. Quando passa de novo, volta a `false`.

**Uma coluna nova é necessária**: `next_review_at`. Daria para calcular a data a partir de `last_reviewed_at` mais o degrau, mas ter a data gravada deixa simples buscar "o que está vencido hoje". É o mesmo modelo que os flashcards já usam (`next_review_date`). A mudança só adiciona; nada é apagado ou renomeado.

```sql
ALTER TABLE public.user_vocabulary
  ADD COLUMN next_review_at timestamptz;

CREATE INDEX user_vocabulary_due_idx
  ON public.user_vocabulary (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

COMMENT ON COLUMN public.user_vocabulary.next_review_at IS
  'Spaced-review due date for "I know it"; NULL = not scheduled or fully mastered.';
```

As permissões e o RLS atuais (cada aluno só vê as próprias linhas) já cobrem a coluna nova. Não preciso de grants nem policies novos.

**Mudança em `markKnown`** (só no app):
- Lê o degrau atual pelo `mastery_level`.
- Grava o próximo `mastery_level`, `next_review_at = agora + intervalo`, `times_reviewed + 1`, `last_reviewed_at = agora` e `is_difficult = false`.
- Uma palavra que ainda não venceu não avança se for marcada de novo no mesmo dia. Isso impede pular a escada clicando várias vezes.

## 2. Volta para a aba "Today"

- A aba Today ganha uma seção **"Review due"** acima das 10 palavras novas. Ela mostra as palavras com `next_review_at <= agora` e `mastery_level < 100`, no máximo 10 por dia, começando pelas mais atrasadas.
- O lote diário de 10 palavras novas continua igual: mesma geração, mesma regra de lição e mesmo indicador verde do dashboard.
- A barra "{n} of {total} words known" passa a contar as palavras revisadas ou marcadas **hoje**. Uma palavra que já passou do degrau de hoje aparece esmaecida, com o selo "Known" até amanhã.
- A leitura usa a mesma consulta `user_vocabulary` que a tela já carrega (`byWord`), sem nova chamada ao servidor. As palavras de revisão vêm da lista `vocabulary` que também já é carregada.

## 3. Novo significado de "Learned" e do limite 75

- **Learned** = palavra no degrau 4 ou acima (`mastery_level >= 75`). Ou seja, o aluno acertou nas revisões de 1, 3 e 7 dias. O limite 75 continua valendo, mas deixa de significar "clicou uma vez" e passa a significar "lembrou por mais de uma semana".
- Palavras nos degraus 1 a 3 aparecem como **"Learning"**: um selo na aba Today/Review, não uma nova aba.
- "Redo today's words" continua zerando `mastery_level`. Também vai limpar `next_review_at` das palavras de hoje.

## 4. Outras telas e contagens afetadas

| Onde | Situação hoje | Ajuste |
|---|---|---|
| Dashboard "Words mastered" (`todayVocabularyMastered`, via `studyDay.ts`, regra `>= 70` com revisão hoje) | Conta toda palavra marcada hoje | Continua contando palavras **revisadas com sucesso hoje**. Como o primeiro degrau é 20, a regra passa a ser "avançou de degrau hoje", ou seja, `last_reviewed_at` de hoje e `mastery_level > 0`. Ajuste em `studyDay.ts` e nos testes |
| study-snapshot (`useStudyContext`, "masteredWords >= 70" por nível) | Total dominado no nível | Passa a usar `>= 75` (Learned), igual à tela |
| vocabulary-progress (`useVocabularyProgress`, `>= 75`) | Total aprendido | Sem mudança de regra. Os números caem naturalmente até as revisões acontecerem |
| vocabulary-batch-progress (`useActivityIndicators`, bolinha verde de vocabulário novo) | "Lote do dia concluído" se todas tiverem mastery alto | Passa a considerar o lote concluído quando cada palavra do lote recebeu pelo menos um "I know it" (`mastery_level > 0`). Assim, a bolinha não volta a acender só porque as palavras estão em revisão |
| Relatório da liga (`leagueReport.ts`, `>= 75`) | Palavras dominadas | Sem mudança de regra |
| Streak / `credit_study_day` (10 palavras com `last_reviewed_at` hoje) | — | **Sem mudança.** Revisões também gravam `last_reviewed_at`, então continuam contando para o dia de estudo. A regra continua só no banco |

## 5. Os ~220 registros já marcados como aprendidos

**Risco**: se eu simplesmente baixar todos para o degrau 1, o "Learned" e o "Words mastered" dos alunos despencam de repente e parece que eles perderam progresso. Se eu deixar tudo em 100, essas palavras nunca entram em revisão.

**Proposta (sem apagar nada):**
- Mantenho `mastery_level`, `times_reviewed` e `last_reviewed_at` como estão. O histórico fica preservado.
- Coloco esses registros no **degrau 5** (`mastery_level = 90`), com `next_review_at` escalonado a partir de `last_reviewed_at` mais 7 dias. Se essa data já passou, uso hoje mais 0 a 6 dias, distribuído para não cair tudo no mesmo dia.
- Assim eles continuam contando como "Learned" (90 ≥ 75), mas entram numa revisão de confirmação. Acertou: vai para 100. Errou: volta 2 degraus.
- Isso é uma atualização de dados, feita depois da coluna existir, num passo separado. Antes de rodar, eu confiro a contagem exata (os 220) e mostro para você.

## Fora do escopo

Lógica pedagógica de lições, geração do lote de 10 palavras, gravação de pronúncia, Streak, RLS e autenticação ficam como estão.

## Ordem de execução (após aprovação)

1. Migration da coluna `next_review_at`.
2. Funções puras da escada, com testes (degrau → intervalo → mastery).
3. `markKnown`, seção "Review due" e selo "Learning".
4. Ajustes em `studyDay.ts`, `useStudyContext` e `useActivityIndicators`.
5. Conversão dos registros existentes, com a contagem conferida antes.
6. Lint, tipos, testes, build e validação no navegador.
