# Dashboard responsivo

## Objetivo
Ajustar somente a composição visual do Dashboard existente para que celular, tablet e desktop compartilhem a mesma hierarquia de aprendizagem.

## Implementação
- Manter o `NextStepCard` como primeiro destaque no mobile, usando sua variante compacta e os dados reais atuais.
- Ordenar os blocos seguintes como: progresso de hoje, habilidades, Smart Review, atalhos e acesso ao plano de estudo.
- Adaptar grids, espaçamento e proporções por breakpoint, sem duplicar componentes ou consultas.
- Preservar o resumo de nível, streak, meta diária e ritmo semanal como contexto complementar.
- Reutilizar exclusivamente logo, EVO, navegação, indicadores, links e componentes atuais.

## Validação
- Conferir desktop 1440×900 sem scroll nas informações essenciais.
- Conferir tablet e mobile sem overflow horizontal, cortes ou sobreposições.
- Confirmar links e ações existentes, compilação e testes.

## Limites técnicos
Nenhuma alteração em banco, migrations, rotas, APIs, funções de servidor, hooks, queries, IA, CEFR, evidências, confidence, recomendações, quotas ou regras pedagógicas.
