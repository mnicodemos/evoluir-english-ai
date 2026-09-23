# Fase final — EVO no AI Teacher

## Objetivo
Integrar a EVO uma única vez na abertura do AI Teacher, reutilizando o guia e o PNG oficial já aprovados, sem alterar a conversa ou a lógica pedagógica.

## Auditoria confirmada
- Rota: `/teacher`.
- Experiência principal: `AiTeacherChat`.
- Identidade atual: título “AI Teacher”, subtítulo e ícone genérico; saudação fixa exibida somente quando não há mensagens.
- Reuso disponível: `EvoGuide` e o PNG oficial transparente já usados nas demais áreas.
- A conversa já usa os elementos instalados de conversa, mensagem e carregamento; eles serão preservados.

## Implementação
1. Remover o ícone genérico do cabeçalho, mantendo título, subtítulo e ações do AI Teacher.
2. Adaptar a saudação inicial existente para apresentar a EVO com `EvoGuide`, usando a mensagem determinística e acolhedora aprovada.
3. Exibir a EVO somente no estado inicial sem mensagens; histórico, respostas e novas mensagens continuam sem avatar repetido.
4. Acrescentar apenas a tradução necessária em PT-BR e registrar o encerramento desta fase no roadmap.

## Preservação
- Nenhuma alteração em prompts, contexto, `teacherTurn`, modelo, gateway, quotas, histórico, persistência, evidências, autenticação, RLS, voz, streaming ou avaliação.
- Nenhuma nova chamada de IA, consulta, API, tabela, migration ou estado.
- O AI Teacher continua sendo a experiência pedagógica; a EVO atua apenas como companheira visual da prática.
- Futuras aparições da EVO exigirão justificativa funcional ou pedagógica e uma nova fase aprovada.

## Validação
- Confirmar abertura, presença única da EVO, chat, envio, histórico e ausência de chamadas extras.
- Validar 320, 375, 390, 414, 768, 1280 e 1440 px, incluindo área de conversa, campo e botões.
- Executar testes existentes, build, TypeScript, lint e formatação; reportar a contagem final e créditos consumidos.
