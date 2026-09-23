# Ajuste final — EVO na abertura do diagnóstico

## Escopo
- Criar uma variação visual compacta da composição já existente da EVO, reutilizando exatamente o PNG oficial transparente.
- Aplicar a variação somente à abertura do diagnóstico: reduzir a imagem em aproximadamente 12–14% e diminuir discretamente o espaçamento vertical do card.
- Manter a tela de resultado com a variação e dimensões atuais, sem alterações.

## Validação
- Confirmar visualmente 320, 375, 390, 414, 768, 1280 e 1440 px, sem cortes, distorção, sobreposição, overflow ou rolagem horizontal.
- Executar testes, build, TypeScript, lint e formatação.
- Conferir que Dashboard, Landing, textos e lógica do diagnóstico não foram alterados.

## Detalhes técnicos
- Estender `EvoGuide` com uma opção exclusiva para a abertura, preservando `diagnosis` para o resultado.
- Alterar somente a instância inicial em `onboarding.tsx` e registrar o ajuste no checklist do projeto.
- Nenhuma alteração de dados, IA, cálculo, CEFR, persistência ou imagem.
