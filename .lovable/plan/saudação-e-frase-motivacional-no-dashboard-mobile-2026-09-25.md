# Saudação e frase motivacional no Dashboard mobile

## Objetivo
Preencher somente o espaço vazio indicado no Dashboard mobile com o bloco de saudação e reflexão diária já existente no desktop.

## Implementação
- Reutilizar `EvoDailyReflection`, sem criar outra saudação ou conteúdo.
- Adicionar uma apresentação em formato de card, visível apenas abaixo do breakpoint desktop.
- Posicionar o card logo após o seletor de nível, ocupando a célula vazia ao lado dele nas larguras mostradas na referência.
- Manter a apresentação atual dentro de “Your next step” exclusivamente no desktop, sem qualquer alteração visual ou funcional.
- Preservar cores da árvore por horário, textos, dados, dimensões e ordem dos demais cards.

## Validação
- Conferir o Dashboard em mobile, incluindo 411 px, sem sobreposição ou rolagem horizontal.
- Confirmar que o desktop permanece idêntico e não exibe o bloco duas vezes.
- Executar testes existentes e validar compilação.
- Não alterar lógica, banco, IA, páginas ou outros componentes.
