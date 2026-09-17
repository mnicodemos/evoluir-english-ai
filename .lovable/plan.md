# Fase 1 — Segurança e controle da IA

## Objetivo
Aplicar correções incrementais no projeto existente, sem alterar currículo, rotas visíveis, autenticação, UI ou dados atuais. A conta Premium existente continuará Premium; apenas a concessão automática por e-mail será removida.

## 1. Proteger operações privilegiadas
- Confirmar dependências das três funções `SECURITY DEFINER`: criação de perfil, manutenção do maior nível e concessão Premium.
- Remover com segurança o gatilho de concessão Premium por e-mail e substituir sua função por comportamento neutro durante a transição, sem rebaixar usuários existentes.
- Revogar execução de funções de gatilho para `PUBLIC`, visitantes e usuários comuns; permitir somente ao proprietário técnico necessário.
- Manter os gatilhos de criação de perfil e maior nível funcionando internamente.
- Executar novamente a auditoria de segurança e testar que chamadas diretas são negadas.

## 2. Camada central de consumo da IA
- Criar tabelas aditivas para configurações de limite, eventos de uso, janelas de rate limit e cache reutilizável.
- Registrar usuário, operação, início/fim, duração, modelo, sucesso/erro, tokens quando informados e custo estimado quando calculável.
- Configurar limites por operação e plano (`free`/`premium`) em um único local ajustável no banco.
- Criar reserva atômica de uso no banco, acessível somente ao serviço interno, evitando corrida e requisições simultâneas abusivas.
- Aplicar limites diários, mensais, intervalo mínimo e concorrência a chat/talking, TTS, transcrição, lições, quizzes, vocabulário, Writing e dicionário.
- Retornar erro estruturado e mensagem amigável ao atingir limite, preservando todo o progresso.

## 3. Centralizar Gemini e autenticação
- Criar um executor Gemini único no servidor para chamadas normais e streaming, com autenticação, medição, logging, limite, rate limit e tratamento consistente de falhas.
- Reutilizar um único verificador de sessão nas rotas de AI Talking, TTS e transcrição.
- Migrar gradualmente os consumidores existentes sem mudar seus contratos públicos.
- Exigir sessão no dicionário antes de qualquer fallback para Gemini.
- Remover o uso da IA local do navegador em AI Talking, relatório e Writing; manter apenas fallbacks permitidos, como voz nativa para falha de áudio.

## 4. Cache e prevenção de regeneração
- Preservar a consulta existente de lições, testes e vocabulário antes da chamada Gemini.
- Usar cache compartilhado somente em respostas reutilizáveis e não personalizadas, com chave hash e expiração.
- Manter o cache persistente de TTS no navegador e consultar cache antes do bloqueio temporário.
- Evitar chamadas duplicadas simultâneas para a mesma operação/conteúdo.

## 5. Validar respostas e erros pedagógicos
- Substituir `JSON.parse` genérico por schemas Zod específicos para relatório, Writing, lição, quiz, vocabulário e dicionário.
- Rejeitar scores ausentes, inválidos, `NaN`, menores que 0 ou maiores que 100; nunca persistir fallback zero como avaliação válida.
- Validar quantidade/opções/resposta correta antes de salvar quizzes e validar todo conteúdo antes de criar registros relacionados.
- Criar armazenamento aditivo de erros estruturados com tipo, categoria, texto original/corrigido, explicação, gravidade, habilidade, frequência e datas.
- Preservar o campo legado de erros enquanto os leitores migram, evitando quebra de histórico.

## 6. TTS, storage e tratamento de falhas
- Para TTS 429, respeitar `Retry-After`, não repetir em loop, registrar a falha e manter a voz nativa existente como fallback.
- Manter limites atuais de gravação e formatos; gravações continuam temporárias e não serão salvas em storage.
- Confirmar bucket de avatar privado, limite de 5 MB e políticas por pasta do usuário; corrigir apenas se a validação encontrar desvio.
- Exibir mensagens amigáveis de limite/indisponibilidade nas telas existentes, sem redesign.

## 7. Validação obrigatória
- Testes automatizados focados na configuração, schemas, limites e normalização de erros.
- Verificações reais de visitante, usuário autenticado, Premium, isolamento dos dados e bloqueio de função privilegiada.
- Testar Gemini autenticado, cache, limite diário, rate limit, resposta inválida e ausência de loop em 429.
- Testar AI Talking completo: abertura, transcrição, streaming, áudio e relatório.
- Testar Writing exclusivamente pelo backend Gemini.
- Executar checagem TypeScript estrita, lint, build e inspeção de erros do navegador/servidor.

## Detalhes técnicos
- Alterações de banco serão somente aditivas, exceto a remoção do gatilho inseguro e revogação de permissões; nenhum registro Premium será alterado.
- Todas as novas tabelas públicas terão `GRANT`, RLS e policies explícitas na mesma migration.
- Funções de controle serão `SECURITY DEFINER` com `search_path` fixo e execução exclusiva do serviço interno.
- A implementação manterá Gemini pela conexão já configurada e os modelos atuais; não haverá troca de fornecedor.
- Os limites iniciais serão conservadores e diferenciados por plano, mas permanecerão editáveis em uma tabela central.

## Fora desta fase
Nenhuma mudança em CEFR, nivelamento, currículo, dashboard, Speaking, Vocabulary ou design visual.
