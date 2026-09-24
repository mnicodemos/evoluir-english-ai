# Correção localizada do Dashboard — reflexão diária e momentum

## Implementação
- Restaurar a faixa superior original do card “Your next step”, mantendo intacta a composição inferior com Next Step, Quick Win, AI Learning Insight e My Progress Snapshot.
- Inserir `EVO Daily Reflection` somente no espaço superior direito dessa faixa, reutilizando `EvoGuide`, o PNG oficial transparente, o nome do perfil e a seleção diária determinística já criada.
- Adaptar a coleção local para reflexões originais inspiradas em princípios estoicos, com versões em inglês e português e saudação pelo horário local, sem IA, API ou persistência.
- Manter o conteúdo atual do Smart Review intacto e inserir `Your Momentum` somente no espaço superior direito da faixa já ocupada pela apresentação da EVO.
- Reutilizar apenas o streak real já carregado no perfil. Quando ele não existir, mostrar o estado neutro aprovado; não exibir aulas, minutos ou evolução percentual sem dados semanais reais já disponíveis nesse ponto.

## Layout e responsividade
- Preservar alturas, divisões, posições e espaçamentos dos conteúdos aprovados; os dois novos blocos usarão apenas as áreas superiores vazias destacadas.
- Em telas estreitas, ocultar os complementos laterais quando não couberem sem aumentar a altura dos cards; todo o conteúdo funcional atual continuará visível e inalterado.
- Validar 320, 375, 390, 414, 768, 1280 e 1440 px, sem overflow, corte, deformação ou deslocamento do conteúdo existente.

## Validação
- Manter testes da reflexão diária e ampliar a cobertura para os dois idiomas e estabilidade por usuário/data.
- Executar testes existentes, TypeScript, lint, formatação e build.
- Confirmar visualmente que o PNG oficial permanece sem filtros e que nenhuma consulta, chamada de IA, rota, regra pedagógica ou persistência foi adicionada.
