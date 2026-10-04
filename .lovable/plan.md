# Ajustes visuais do dashboard mobile e desktop

## Alterações

- Adicionar a terceira frase curta no “Why this matters”, mantendo cada frase mobile em uma linha, e trocar os checks por pontos na cor do texto no mobile e desktop.
- Alterar o selo do nível no topo mobile para teal.
- Exibir o círculo de minutos como `executados/meta` em uma linha e `min.` abaixo, com tipografia ajustada.
- Exibir Accuracy zerada como `0%` no mobile e desktop.
- Fazer ícones e barras de cada habilidade seguirem a cor do seu label de estado (Advanced, Strong ou Priority), no mobile e desktop.
- Quando os quatro indicadores diários estiverem zerados, substituir somente a lista por “Nothing yet today · X min to hit your goal”, preservando o espaço e os elementos laterais; restaurar a lista quando houver qualquer progresso.

## Validação

- Conferir o dashboard autenticado em 360 px e 411 px, verificando linhas sem corte e dimensões preservadas.
- Conferir as alterações compartilhadas no desktop em 1280 px.
- Confirmar lint, TypeScript, testes sem cross-user e build sem erros.
