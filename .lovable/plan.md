# Retomada da Fase 1 — Hardening e confiabilidade

## Escopo

Fechar somente as pendências explicitadas, sem refazer validações já aprovadas e sem alterar pedagogia, pagamentos, identidade visual ou funcionalidades existentes.

## Execução

1. **Arquivo de ambiente e segredos**
   - Confirmar as regras `.env*` e `!.env.example` no ignore.
   - Validar que o arquivo contém apenas configuração pública já auditada.
   - Remover o `.env` do conjunto versionado sem apagar a cópia local, respeitando que o estado Git é administrado pela plataforma; se essa operação não puder ser realizada pelo ambiente, registrar como bloqueador explícito.
   - Reexecutar a verificação de vazamentos disponível.

2. **Funções privilegiadas**
   - Consultar o banco ativo para revisar todas as funções `SECURITY DEFINER`: proprietário, `search_path`, permissões de execução, público autorizado, tabelas acessadas e risco de escalada.
   - Corrigir somente risco comprovado, com alteração mínima e migration versionada quando necessária.

3. **Autorização administrativa**
   - Substituir verificações de e-mail fixo por `user_roles`/`has_role`, sempre no servidor e antes de qualquer acesso privilegiado.
   - Preservar o painel e seus fluxos; validar admin, usuário comum e chamada direta proibida.

4. **Dependência vulnerável**
   - Mapear a cadeia que introduz `js-yaml`, separar produção de tooling e aplicar apenas atualização/override compatível.
   - Reinstalar com lockfile atualizado e repetir o scanner. Se a correção exigir atualização estrutural, não aplicá-la e documentar formalmente o risco e a recomendação.

5. **Cross-user e ambiente de teste**
   - Verificar se o backend compartilhado por preview e produção permite testes isolados sem tocar usuários reais.
   - Usar duas contas exclusivamente de teste e fixtures válidos, com comprovação bidirecional de SELECT/INSERT/UPDATE/DELETE por RLS.
   - Não relaxar políticas. Se não houver ambiente seguro ou credenciais dedicadas disponíveis, manter o item bloqueado e especificar exatamente o requisito externo.

6. **E2E, acessibilidade, motion e PWA**
   - Expandir a suíte existente, sem substituí-la, para cobrir fluxos públicos, autenticados, Premium sem cobrança, segurança, axe público/autenticado, desktop/Pixel 7, reduced motion e metadados/ícones PWA.
   - Corrigir seletores quando for apenas fragilidade do teste; investigar qualquer falha funcional antes de alterar produto.

7. **CI e validação final**
   - Manter a ordem Gitleaks → install → lint → TypeScript → Vitest → build → E2E.
   - Fazer CI falhar claramente quando credenciais obrigatórias de cross-user/E2E autenticado estiverem ausentes; nenhum skip silencioso será aceito.
   - Executar lint, tipos, 478 testes, build, E2E viável, scanners e smoke test no ambiente seguro disponível.

## Entrega

- Atualizar o roadmap somente com estados comprovados.
- Entregar tabela por pendência com evidência, alteração e risco residual; separar bloqueadores, pendências e aprovados.
- Informar arquivos, migrations, dependências, testes ignorados, scanners, CI, E2E, cross-user e smoke test.
- Declarar **FASE 1 — APROVADA** somente se todos os critérios estiverem comprovadamente verdes; caso contrário, não declarar aprovação.

## Restrições técnicas

- O ambiente não permite comandos que alterem diretamente o estado interno do Git; isso pode impedir a execução literal de `git rm --cached`, embora o ignore e a ausência de segredos possam ser validados.
- Preview e produção usam o mesmo backend. Testes destrutivos ou com duas contas só serão executados se puderem ser isolados de usuários reais e limpos com segurança.
