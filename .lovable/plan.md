# Otimizar voz, cache de áudio e resiliência de progresso

## Objetivo
Reduzir o tempo percebido entre a fala do aluno e a resposta do AI Talking, evitar novas chamadas de áudio para conteúdo estático já ouvido e impedir perda de respostas/progresso por expiração de sessão ou falha temporária.

## Alterações

### 1. Voice Coach com resposta progressiva
- Criar um endpoint autenticado de conversa que use a conexão Gemini existente em modo streaming e devolva eventos de texto conforme forem gerados.
- Manter relatórios e demais gerações compatíveis com as funções atuais; compartilhar a montagem e o tratamento das chamadas Gemini para não duplicar regras.
- No AI Talking, mostrar imediatamente e de forma distinta os estados de transcrição, preparação da resposta e reprodução.
- Atualizar a mensagem do professor enquanto o texto chega.
- Separar o texto recebido em frases curtas por pontuação; iniciar a síntese e reprodução da primeira frase completa enquanto o restante ainda é gerado, preservando a ordem das frases.
- Manter a voz única atual e o fallback do navegador quando o serviço de áudio estiver temporariamente indisponível.

### 2. Cache persistente para áudio estático
- Marcar chamadas de flashcards, vocabulário e conteúdo fixo como cacheáveis; manter respostas dinâmicas do AI Talking como `no-store`.
- Na rota de áudio, enviar `Cache-Control: public, max-age=31536000, immutable` somente para termos estáticos e manter `no-store` nos demais casos.
- No navegador, criar uma chave SHA-256 baseada em texto normalizado + voz fixa + velocidade + versão do formato.
- Consultar primeiro memória e Cache API; após uma geração estática bem-sucedida, persistir o PCM completo para reutilização entre sessões e recarregamentos.
- Deduplicar cliques simultâneos para o mesmo áudio e preservar o streaming na primeira reprodução.

### 3. Sessão e progresso resistentes a falhas
- Preservar a configuração atual de sessão persistente e renovação automática do cliente, sem editar arquivos gerados.
- Criar um utilitário tipado para mutações de progresso: executar, detectar 401, renovar a sessão uma vez e reenviar exatamente uma vez; demais falhas não entram em loop.
- Aplicar o utilitário às gravações de vídeo, conclusão de lição, avaliação de flashcards e resultado de quiz.
- Tornar o rascunho do quiz específico por usuário e lição, mantendo respostas e resultado no armazenamento local durante navegação ou reload.
- Se o envio do quiz falhar, manter respostas e pontuação na tela e oferecer nova tentativa de salvamento, sem apagar o trabalho do aluno.

## Validação
- Validar tipagem TypeScript estrita e a compilação existente.
- Testar as rotas de transcrição, conversa e áudio autenticadas, incluindo eventos progressivos e cabeçalhos de cache/no-store.
- Testar no navegador: estados intermediários do AI Talking, início do áudio antes do fim da resposta, reutilização do cache em segundo clique/reload e restauração do quiz.
- Confirmar que uma mutação 401 faz somente uma renovação e uma repetição, sem duplicar registros.
