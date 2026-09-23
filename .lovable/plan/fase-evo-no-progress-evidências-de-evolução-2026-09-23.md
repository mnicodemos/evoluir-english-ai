# Fase — EVO no Progress / Evidências de evolução

## Auditoria confirmada

- A página principal é `src/routes/_authenticated/progress.tsx`, que renderiza `LearningJourneyCard` e, dentro dele, o `ProofOfProgressCard` existente.
- `ProofOfProgressCard` já recebe do servidor os estados determinísticos necessários: `highlights` para evidência real de evolução, `keepPractising` para evidência ainda insuficiente e `levelChange` para mudança oficial de CEFR.
- A regra atual já separa evolução observável (`TRANSFER`, `CONSOLIDATION`, `OBSERVABLE_GROWTH`, `NEW_EVIDENCE`) de simples atividade. Nenhuma nova interpretação é necessária.
- Loading mantém o skeleton existente; erro ou ausência de resposta não renderizam a seção; sem destaques e sem habilidades em acompanhamento mantém o estado vazio atual, sem EVO.
- O `EvoGuide` existente já usa o PNG oficial transparente e a variação `imageSize="lesson"` fornece aproximadamente 88 px no mobile e 112 px no desktop.

## Implementação

- Reutilizar uma única instância de `EvoGuide` no topo de `ProofOfProgressCard`, antes dos dados existentes.
- Quando `highlights.length > 0`, exibir uma mensagem factual indicando que já existem evidências de desenvolvimento, sem citar score, causa ou interpretação nova.
- Quando não houver destaque, mas `keepPractising.length > 0`, exibir a mensagem neutra de que as evidências ainda estão sendo construídas.
- Preservar integralmente nível oficial, agrupamentos, habilidades, textos de evidência, ordem e estado “continue praticando”.
- Não alterar `EvoGuide`, consultas, funções de servidor, regras pedagógicas, persistência, gráficos ou outras áreas do produto.

## Arquivos que serão alterados

- `src/components/ProofOfProgressCard.tsx` — presença contextual da EVO baseada exclusivamente nos estados já retornados.
- `src/lib/uiDictionary.ts` — duas mensagens estáticas em PT-BR.
- `roadmap.md` — registro conciso da fase.

## Validação

- Confirmar EVO com destaque real e mensagem neutra quando só houver evidência insuficiente; ausência da EVO no loading, erro e vazio total.
- Confirmar que nenhuma consulta, chamada de IA, cálculo, score, CEFR, evidência ou persistência foi adicionada.
- Validar 320, 375, 390, 414, 768, 1280 e 1440 px sem overflow, corte, deformação, sobreposição ou quebra dos gráficos.
- Executar testes existentes, build, TypeScript, lint e formatação; verificar que Dashboard, Diagnóstico, resultado, aulas e Smart Review permanecem intactos.
