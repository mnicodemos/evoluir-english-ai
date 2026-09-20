# Melhoria incremental do card “Your next step”

## Objetivo
Ampliar apenas o card existente do Dashboard com uma coluna informativa “AI Learning Insight”, mantendo a recomendação e a ação atuais sem mudanças.

## Implementação
- Estender a resposta existente de `loadNextStep` com o nível CEFR, confidence e disponibilidade de evidência da própria skill já escolhida pelo algoritmo atual.
- Não criar nova consulta no navegador: a nova área usará a mesma resposta já carregada pelo card.
- Manter intactos o ranking, o motivo, a aula recomendada, o botão e as rotas.
- Adaptar `NextStepCard` para duas colunas no desktop e empilhamento em tablet/mobile, usando os estilos atuais.
- Exibir somente valores existentes; quando confidence/evidência não estiver disponível, informar isso de forma discreta, sem estimativas.
- Adicionar as traduções PT-BR necessárias ao dicionário existente.

## Validação
- Cobrir o enriquecimento do resultado sem alterar os cenários atuais do recomendador.
- Executar testes existentes, verificação de tipos e build.
- Conferir visualmente o Dashboard em desktop e mobile, quando houver sessão autenticada disponível.

## Limites preservados
Sem novas chamadas de IA, consumo do AI Gateway, tabelas, rotas, contratos externos, mudanças de plano Free/Premium ou alterações na lógica pedagógica.
