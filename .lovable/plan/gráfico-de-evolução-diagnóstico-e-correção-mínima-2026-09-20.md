# Gráfico de evolução — diagnóstico e correção mínima

## Diagnóstico (causa raiz)

O gráfico lê a tabela `progress`. Essa tabela **não guarda o estado real de cada momento**: cada novo registro é gravado como "melhor resultado histórico" (cada nota só sobe, nunca desce, copiando a nota anterior quando a atividade não tem aquela habilidade). Resultado: dezenas de registros com exatamente os mesmos valores (ex.: 95 / 100 / 93 / 75 repetidos hoje).

Somado a isso, o gráfico repete o último valor conhecido nos dias sem registro. Por isso a linha aparece plana e com os mesmos percentuais em dias diferentes.

Também existe uma inconsistência: o gráfico mostra Listening, Reading, Talking e Writing, mas o histórico avaliado até agora tem apenas grammar, vocabulary e writing.

## Dados históricos reais já existem

A tabela `assessment_skill_results` guarda, por habilidade e por momento, o resultado real avaliado (ex.: grammar 63 → 66 → 67 → 68 → 62 → 64; vocabulary 72 → 73 → 75; writing 79). É exatamente o histórico de evolução que o gráfico deveria mostrar. **Nenhuma tabela nova é necessária.**

## Correção proposta (mínima)

1. Trocar a origem dos dados do gráfico: de `progress` para `assessment_skill_results` (última avaliação de cada habilidade em cada dia), mantendo o mesmo componente, o mesmo visual e a mesma janela de 7 dias.
2. Desenhar uma linha por habilidade que tenha histórico real (grammar, vocabulary, writing, listening, reading, speaking) e ocultar as que ainda não têm nenhuma avaliação, em vez de mostrar linha vazia.
3. Manter o valor do último dia avaliado quando não houve prática no dia seguinte (é o estado real vigente), mas sem inventar valores antes da primeira avaliação.
4. Quando o usuário ainda não tem histórico suficiente, exibir a mensagem já existente de "sem dados" em vez de linha plana.
5. Traduções PT-BR das novas legendas de habilidade reaproveitando o dicionário atual.

## Limitação a informar ao usuário

Habilidades ainda não praticadas (falar, ouvir, ler) não têm histórico e por isso não terão linha até a primeira atividade avaliada. Nada é criado artificialmente.

## Fora de escopo (não será alterado)

CEFR, evidências, perfil de habilidades, motor de recomendação, `progress` (segue alimentando streak/ligas), Stripe, Free/Premium, rotas e banco de dados.

## Detalhes técnicos

- `src/components/EvolutionChart.tsx`: `useProgressHistory` passa a consultar `assessment_skill_results` (`skill, score, assessed_at`, filtro por `assessed_at >= hoje-6d`, ordem crescente), agregando o último resultado por `(dia, skill)`; séries dinâmicas conforme habilidades presentes.
- Consumidores do hook (`progress.tsx`, `LearningPathCard.tsx`, `leagueReport.ts`) mantêm contratos; se algum depende do shape antigo de `progress`, será mantido em consulta separada e intacta.
- Testes: caso novo em `src/lib/` cobrindo a agregação por dia/habilidade; suíte atual (156) e build devem seguir verdes.
