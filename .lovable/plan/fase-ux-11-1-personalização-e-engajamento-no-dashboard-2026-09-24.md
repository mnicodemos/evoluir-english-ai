# Fase UX 11.1 — Personalização e engajamento no Dashboard

## Implementação
- Reorganizar somente o conteúdo do `NextStepCard`, preservando recomendações, ações, destinos e regras já existentes.
- Adicionar `EVO Daily Reflection` ao lado de “Your next step” no desktop, reutilizando `EvoGuide`, o PNG oficial transparente e os estilos atuais.
- Usar uma coleção local de mensagens e uma seleção determinística pela data do dia; a saudação será ajustada ao horário e incluirá o nome já disponível no perfil.
- Adicionar `My Progress Snapshot` ao lado de “AI Learning Insight”, reutilizando a mesma resposta já carregada por `loadNextStep`: nível atual, habilidade mais forte quando existente, foco recomendado e sinal existente de prática recente.
- Não criar consultas, cálculos pedagógicos, scores, estados persistidos, tabelas, rotas ou chamadas de IA.
- Incluir as traduções PT-BR necessárias no dicionário atual.

## Responsividade
- Desktop: duas linhas em duas colunas — Next Step + Daily Reflection; AI Learning Insight + Progress Snapshot.
- Mobile/tablet estreito: ordem Next Step, Daily Reflection, AI Learning Insight, Progress Snapshot, sem alterar os botões ou conteúdos existentes.
- Preservar Quick Win e Skill Quest nos seus contextos atuais, sem recalcular ou duplicar recomendações.

## Validação
- Cobrir a seleção diária determinística com teste unitário, incluindo estabilidade no mesmo dia e mudança no dia seguinte.
- Confirmar que os dados do snapshot vêm apenas da resposta existente e que ausências são apresentadas sem estimativas.
- Validar visualmente em 360, 390, 768 e 1280 px, sem overflow, cortes ou sobreposição.
- Executar testes existentes, TypeScript, lint, formatação e build.

## Limites preservados
- Nenhuma mudança em AI Teacher, CEFR, Evidence, Learning State, recomendações, pedagogia, autenticação, banco, rotas, billing, quotas ou integrações.
- A presença da EVO permanece restrita a esta nova utilização funcional aprovada; nenhuma outra tela será alterada.
