# Dashboard — três ações e Study Streak

## Alteração
- Manter a recomendação principal, o Quick Win e o Skill Quest como as três fontes já existentes, sem recalcular prioridade ou disponibilidade.
- Padronizar os rótulos para “Practice now”, “Quick practice” e “Take the challenge”, preservando os destinos dinâmicos já retornados por cada fonte.
- Renderizar os três links com o componente `Button` no mesmo variant e tamanho do “Play sentence” do Listening Lab, sem alterar o botão de referência.
- Ajustar somente em desktop o número do Study Streak para a mesma classe de tamanho usada no nome do usuário; tablet e mobile permanecem como estão.

## Segurança de comportamento
- Links apenas abrem a experiência recomendada; não acionam nem limpam estados de conclusão e não disparam Redo.
- Lições concluídas continuam excluídas pela seleção existente; estados e telas atuais de Listening, Writing e Vocabulary permanecem autoridades dos seus próprios ciclos.
- Se Quick Win ou Skill Quest não existir, seu botão continua ausente; nenhuma rota ou fallback novo será inventado.

## Validação
- Cobrir por testes os três rótulos e a separação dos destinos no cenário Vocabulary / Quick Win / Listening Challenge.
- Verificar navegação sem acionar Redo, equivalência visual com “Play sentence”, Study Streak e ausência de overflow em 1920, 1440, 1280, 834 e 390 px.
- Executar testes relevantes, suíte completa, typecheck e build.

## Escopo técnico
- Somente apresentação e testes do Dashboard.
- Nenhuma alteração de banco, IA, Evidence, Learning State, Invisible Gaps, Skill Quest, CEFR, Confidence, autenticação ou rotas.
