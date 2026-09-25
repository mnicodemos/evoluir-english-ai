# Organizar o Admin Panel e adicionar benchmark

## Objetivo
Organizar o painel administrativo existente em três abas independentes — **Usuários**, **Consumo IA** e **Custo & Performance** — sem reconstruir o painel nem alterar regras do produto.

## Implementação
- Reutilizar o diálogo administrativo e o componente de abas já existentes no projeto.
- Mover a lista atual de usuários para a aba **Usuários**, preservando consulta, contagem e proteção.
- Mover o módulo atual, sem remoções, para a aba **Consumo IA**, mantendo seus filtros e métricas.
- Criar a aba **Custo & Performance** como uma nova visão somente leitura, agregada por operação, provider e modelo.
- Reutilizar `ai_usage_events`, `ai_response_cache`, limites existentes e a autorização server-side atual.
- Mostrar visão executiva, tabela comparativa e projeções; qualquer dado sem medição confiável será exibido como **N/D**.
- Distinguir explicitamente dados observados, calculados, estimados e baseados em premissa, sem ranking de providers.

## Limites confirmados pela auditoria
- Chamadas, modelos, tokens registrados, duração e erros podem ser agregados com segurança.
- First token, first chunk, retries e fallback não possuem medição confiável por evento atualmente; aparecerão como **N/D**.
- HITs de cache podem ser observados cumulativamente na infraestrutura atual; MISS por período não é registrado com segurança e aparecerá como **N/D**.
- Créditos Lovable e custo Google não possuem hoje preço/custo confiável preenchido; custos e projeções dependentes deles aparecerão como **N/D**, sem valores inventados.

## Segurança e escopo
- Todas as consultas permanecerão autenticadas e validadas para o administrador no servidor.
- Nenhum prompt, conversa, chave, segredo ou dado desnecessário de aluno será retornado.
- Nenhuma operação de IA, provider, modelo, limite, quota, regra de usuário, autenticação, billing, tabela ou migration será alterada.

## Validação
- Confirmar as três abas e a preservação integral das duas áreas existentes.
- Confirmar carregamento sob demanda da nova aba e bloqueio para não administradores.
- Validar navegação e leitura em mobile e desktop.
- Executar testes existentes, lint, tipos e compilação.
