# One Screen Dashboard — Evoluir+ English AI

## Objetivo
Reorganizar visualmente o Dashboard existente como um centro de comando pessoal, premium e orientado à ação. Em 1440×900, todas as informações essenciais ficarão na primeira viewport, sem alterar dados, regras, fluxos ou arquitetura.

## Implementação

1. **Composição geral e navegação**
   - Adaptar somente a apresentação do `AppShell` no Dashboard para uma sidebar desktop limpa, com logo oficial, rótulos e as rotas atuais.
   - Manter integralmente navegação mobile, autenticação, perfil, idioma, tema e permissões.
   - Reduzir a presença visual do rodapé no Dashboard desktop para não competir com a experiência principal.

2. **Cabeçalho e resumo**
   - Reorganizar saudação, nome e reflexão diária em um cabeçalho compacto.
   - Reutilizar `LevelCard`, streak, `DailyGoalCard` e `WeeklyFrequency` em uma faixa horizontal de resumo.
   - Preservar troca de nível, liga, meta diária e frequência configurada no Study Plan.

3. **Today's Focus com EVO**
   - Criar uma variante visual compacta do `NextStepCard`, mantendo a mesma query, recomendação e disponibilidade de ações.
   - Reutilizar o PNG transparente oficial por meio de `EvoGuide`.
   - Exibir “EVO · YOUR AI LEARNING COACH”, atividade real, CTA existente e “Why now?” somente com CEFR, situação e razão já retornados pelo sistema.
   - Preservar Quick Win e desafio quando existirem, sem esconder funcionalidade; em desktop, integrá-los de forma compacta ao mesmo módulo.

4. **Progresso, habilidades e Smart Review**
   - Reorganizar minutos/meta diária e progresso real do dia em “Today's Progress”.
   - Adaptar `PathProgressCard` para uma variante compacta com Reading, Listening, Writing e Speaking, usando exatamente os scores atuais.
   - Adaptar `SmartReviewCard` para “Keep Improving”, mantendo a mesma query compartilhada, ordem, motivos e CTAs.
   - Manter estados loading, vazio, erro e ausência de evidência já suportados.

5. **Learning Rhythm e Quick Access**
   - Reutilizar `WeeklyFrequency` em um módulo compacto, respeitando a frequência real do usuário.
   - Reorganizar os atalhos existentes em uma faixa compacta com as rotas atuais: Learning, Vocabulary, Listening, AI Talking, Writing, AI Teacher, Study Plan e Progress.
   - Preservar os indicadores atuais de novas atividades.

6. **Grade responsiva**
   - Desktop: grade de 12 colunas com alturas estáveis e `Today's Focus` como maior destaque.
   - 1440×900 e 1280×800: informações essenciais visíveis sem scroll vertical.
   - Tablet e mobile: reordenar para Focus → Progress → Skills → Keep Improving → Rhythm → Quick Access, sem comprimir tipografia ou copiar o layout desktop.
   - Usar apenas tokens semânticos existentes ou novos tokens visuais no sistema global; preservar temas claro e escuro.

## Arquivos previstos
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/AppShell.tsx`
- `src/components/NextStepCard.tsx`
- `src/components/SmartReviewCard.tsx`
- `src/components/LearningPathCard.tsx`
- `src/components/DailyGoalCard.tsx`
- `src/components/LevelCard.tsx`
- `src/components/WeeklyFrequency.tsx`
- `src/components/EvoDailyReflection.tsx`
- `src/styles.css`
- Traduções/testes apenas se novos rótulos visuais exigirem.

## Restrições garantidas
- Nenhuma tabela, coluna ou migration.
- Nenhuma rota, API, server function, hook, query ou chamada de IA nova.
- Nenhuma alteração em CEFR, evidências, confidence, recomendação, Next Step, Smart Review, Study Plan, streak, daily goal, weekly frequency, quotas, entitlements, auth ou permissões.
- Nenhuma segunda implementação do Dashboard e nenhum dado fictício.

## Validação
- Regressão automatizada completa e verificação do build.
- Validação visual em 1440×900, 1280×800, 768px, 414px, 390px, 375px e 320px.
- Conferir overflow e scroll, nomes longos, inglês/português, loading, vazio, erro, ausência de evidência, níveis CEFR, frequências semanais e todos os CTAs/links.
- Confirmar que o Dashboard desktop apresenta as informações essenciais na primeira viewport e que mobile preserva a hierarquia definida.
