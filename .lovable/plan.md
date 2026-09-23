# Fase — EVO na abertura da aula

## Escopo
- Reutilizar o `EvoGuide` e o mesmo PNG oficial transparente já usado no Dashboard e diagnóstico.
- Inserir uma apresentação única no topo da tela de aula, logo após o título/objetivo e antes do checklist e das abas atuais.
- Exibir “Vamos praticar [habilidade] em um novo contexto.” usando exclusivamente a habilidade já carregada com a aula; quando ausente, usar a versão neutra “Vamos praticar esta habilidade em um novo contexto.”
- Não adicionar botão, etapa, bloqueio, persistência, chamada de IA ou estado novo.

## Visual
- Criar uma variação compacta do `EvoGuide` para aulas: aproximadamente 88 px no mobile e 112 px no desktop, proporção original e sem espelhamento.
- Usar o painel escuro semântico já existente no produto, com texto claro e contraste adequado.
- Preservar integralmente o cabeçalho, checklist, abas, vídeo, resumo, flashcards, quiz e CTAs atuais.

## Validação
- Confirmar 320, 375, 390, 414, 768, 1280 e 1440 px sem corte, deformação, sobreposição ou rolagem horizontal.
- Confirmar que a EVO aparece uma vez no topo e não se repete nos exercícios.
- Executar os 428 testes existentes, build, TypeScript, lint e formatação dos arquivos alterados.
- Não realizar alterações de banco, IA, conteúdo, scoring, CEFR, avaliação ou persistência.

## Arquivos previstos
- `src/components/EvoGuide.tsx`: ampliar somente a API visual reutilizável com a variação de aula e contraste inverso.
- `src/routes/_authenticated/learning/$lessonId.tsx`: adicionar a instância única usando `lesson.skill`.
- `src/lib/uiDictionary.ts`: incluir apenas as traduções estáticas da nova frase.
- `roadmap.md`: registrar a fase e sua validação.
