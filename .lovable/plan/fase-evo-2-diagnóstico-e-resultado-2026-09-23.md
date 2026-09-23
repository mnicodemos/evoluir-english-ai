# Fase EVO 2 — diagnóstico e resultado

## Alteração
- Reutilizar o componente e o PNG oficial transparente já usados no Dashboard, sem editar ou recriar a imagem.
- Adaptar apenas a apresentação da EVO na abertura e no resultado do diagnóstico: composição vertical e compacta no celular; texto e EVO lado a lado no desktop, mantendo a orientação original da personagem.
- Preservar exatamente as mensagens definidas, o CTA existente e todos os dados reais exibidos no resultado.
- Manter o Dashboard, a Landing, perguntas, respostas, pontuação, CEFR, recomendações, persistência e demais fluxos sem alterações.

## Detalhes técnicos
- Criar uma variação visual específica no componente compartilhado `EvoGuide`, sem alterar a variação `dashboard` aprovada.
- Aplicar essa variação somente às duas instâncias existentes no onboarding.
- Não criar banco, API, IA, estado, cálculo ou nova etapa.

## Validação
- Confirmar o mesmo arquivo PNG oficial, transparência, proporção e ausência de fundo próprio.
- Verificar abertura e resultado em 320, 375, 390, 414, 768, 1280 e 1440 px, sem cortes, sobreposição ou rolagem horizontal.
- Confirmar visualmente que o Dashboard permaneceu inalterado.
- Executar testes, build, TypeScript, lint e formatação.
