# Central de E-mails — Fase 2: conexão Microsoft e sincronização

## Objetivo
Conectar a caixa Hotmail autorizada pelo administrador e sincronizar mensagens recebidas via Microsoft Graph, mantendo ImprovMX como encaminhamento de entrada e Resend apenas para envio futuro de respostas.

## Escopo desta fase
- Implementar início e callback OAuth Microsoft Authorization Code + PKCE.
- Proteger state e verifier com cookies HttpOnly, Secure em produção, SameSite=Lax e expiração curta.
- Validar o usuário autenticado e a função admin no servidor usando a autoridade existente `has_role`.
- Persistir somente refresh token criptografado com AES-256-GCM; nunca armazenar senha Hotmail ou expor tokens ao cliente.
- Implementar renovação de access token e rotação do refresh token.
- Sincronizar mensagens do Microsoft Graph com paginação e deltaLink, armazenando IDs de mensagem/conversa para idempotência.
- Classificar destinatários em `contact`, `support` ou `unknown` por correspondência exata dos endereços corporativos.
- Restringir leitura e escrita das tabelas ao service role no servidor.
- Criar testes para OAuth state/PKCE, criptografia, renovação, idempotência e classificação de caixas.

## Restrições obrigatórias
- Não alterar DNS, MX ou configuração do ImprovMX.
- Não ativar recebimento inbound do Resend.
- Não mover nem apagar mensagens no Hotmail.
- Não armazenar senha Microsoft.
- Não enviar respostas nesta fase; envio pelo Resend será fase posterior.
- Não habilitar a sincronização até a configuração OAuth e a validação E2E estarem concluídas.

## Configuração necessária
- `MICROSOFT_OAUTH_STATE_SECRET`
- `MICROSOFT_TOKEN_ENCRYPTION_KEY` (32 bytes codificados em base64)
- `MICROSOFT_REDIRECT_URI` (URI exata do callback)
- URI de callback correspondente cadastrada no Microsoft Entra.

O Client ID já está definido na base técnica da Fase 1. O segredo de estado e a chave de criptografia devem ser configurados no cofre de segredos do ambiente de produção, nunca no código.

## Critérios de aceite
1. Apenas administrador autenticado consegue iniciar e concluir a conexão.
2. Callback rejeita state inválido, expirado ou com nonce/verifier incompatível.
3. A conta conectada é identificada por Graph e validada antes de persistir tokens.
4. Refresh token é armazenado somente criptografado e renovado com segurança.
5. Sincronização incremental não duplica mensagens em reexecuções ou retries.
6. Mensagens endereçadas aos dois aliases são separadas corretamente.
7. Nenhuma ação altera a caixa de entrada original.
8. CI (lint, typecheck, testes e build) passa antes de merge.
9. Validação E2E documenta a conexão real antes de ativar em produção.
