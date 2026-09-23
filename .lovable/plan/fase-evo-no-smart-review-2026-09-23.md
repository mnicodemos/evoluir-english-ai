# Fase — EVO no Smart Review

## Auditoria confirmada
- O Smart Review é renderizado por `SmartReviewCard` no Dashboard, logo após `NextStepCard`.
- Ele reutiliza a consulta já existente `loadNextStep` e recebe recomendações com habilidade, categoria/motivo determinístico e ação existente.
- Loading mantém apenas o skeleton atual; erro, ausência de dados ou lista vazia não renderizam o card.
- `EvoGuide` já usa o PNG oficial transparente e sua variação `lesson` já mede aproximadamente 88 px no mobile e 112 px no desktop.

## Implementação
- Reutilizar `EvoGuide` uma única vez dentro do Smart Review, somente depois de confirmar que há ao menos uma recomendação válida.
- Exibir a mensagem neutra “Essa é uma boa habilidade para reforçar agora.”, sem interpretar score, evidência, causa ou dificuldade.
- Manter abaixo da EVO, sem alterações, o título, a lista ordenada de habilidades, os motivos determinísticos, os recursos e os botões atuais.
- Usar exclusivamente a consulta e os dados já presentes; não adicionar IA, banco, API, persistência, estado ou fluxo.
- Adicionar somente a tradução estática necessária e registrar a fase no roadmap.

## Arquivos previstos
- `src/components/SmartReviewCard.tsx`: composição visual com o `EvoGuide` existente.
- `src/lib/uiDictionary.ts`: tradução PT-BR da mensagem curta.
- `roadmap.md`: registro do escopo e validação.

`EvoGuide.tsx` e o PNG oficial não precisam ser alterados.

## Validação
- Confirmar EVO presente com recomendação válida e ausente nos estados vazio, erro e loading.
- Confirmar que recomendação, habilidade, motivo, ordem e ação permanecem idênticos.
- Validar 320, 375, 390, 414, 768, 1280 e 1440 px sem overflow, corte, deformação, sobreposição ou deslocamento dos botões.
- Executar testes existentes, build, TypeScript, lint e formatação dos arquivos alterados.
- Confirmar que Dashboard fora do Smart Review, Diagnóstico, resultado, aulas e todas as regras pedagógicas permanecem inalterados.
