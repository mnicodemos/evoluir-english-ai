# Ajuste visual — desktop full width

## Alteração
- Remover o limite global de 1440 px do conteúdo e do rodapé no shell autenticado, mantendo `width: 100%` e os paddings responsivos existentes.
- Remover o limite estrutural de 3xl da área da AI Teacher, que hoje continua estreita mesmo dentro do shell amplo.
- Preservar todos os limites locais destinados à leitura, formulários, diálogos e flashcards.

## Validação
- Conferir Dashboard, Learning Center, Lesson, Listening, Writing, Vocabulary, Coach, AI Teacher, Progress, Review, Study Plan e Premium.
- Verificar 1440 px, 1280 px, 834 px e 390 px, incluindo largura útil, alinhamento, grids, navegação e overflow horizontal.
- Executar testes de tipagem e compilação.

## Escopo técnico
- Somente apresentação em componentes compartilhados.
- Nenhuma alteração de funcionalidade, conteúdo, rotas, autenticação, banco, IA ou pedagogia.
