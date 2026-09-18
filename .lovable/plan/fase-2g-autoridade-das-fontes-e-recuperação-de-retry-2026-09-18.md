# Fase 2G — Autoridade das fontes e recuperação de retry

## Escopo
Corrigir somente a autoria confiável de Quiz e Writing e a recuperação segura de retries abandonados. Não executar operações reais, não alterar telas, prompts, questões ou fontes atuais de progresso.

## Implementação
1. **Quiz autoritativo no servidor**
   - Criar uma função autenticada que receba apenas `attemptKey`, `lessonId` e respostas por `questionId`.
   - Buscar questões e gabaritos no servidor, validar que pertencem à lição, recalcular `is_correct`, acertos, total, score e `details`, persistir via acesso privilegiado e iniciar o Dual Write somente com esse registro.
   - Manter a identidade da tentativa e devolver o resultado calculado para a tela preservar o comportamento atual.

2. **Bloqueio de escrita direta em `quiz_results`**
   - Revogar INSERT/UPDATE/DELETE de usuários autenticados e substituir a policy `ALL` por leitura do próprio resultado.
   - Manter registros históricos intactos e conceder escrita apenas ao serviço autoritativo.

3. **Writing autoritativo no servidor**
   - Criar uma função autenticada que receba somente `operationKey`, prompt, texto original e nível.
   - Executar o mesmo prompt e modelo atuais no servidor, validar a resposta, persistir a avaliação completa e gerar o Dual Write a partir do registro persistido.
   - Remover scores e textos processados do contrato aceito do navegador; retornar o feedback autoritativo para a mesma tela.

4. **Recuperação segura de retry**
   - Adicionar uma operação atômica de claim que seleciona retries vencidos e também `retrying` stale após timeout, usando bloqueio transacional e `SKIP LOCKED`.
   - Preservar identidade, contador, backoff e limite de cinco tentativas; impedir que duas execuções processem o mesmo registro simultaneamente.

5. **Testes e validação**
   - Cobrir adulteração pelo próprio usuário, cálculo autoritativo, Writing sem campos derivados no input, idempotência, claim concorrente/stale, limite e diagnóstico.
   - Executar testes existentes e novos, typecheck, lint somente dos arquivos alterados e build.
   - Conferir grants, policies e funções no banco sem criar dados reais ou artificiais permanentes.

## Restrições preservadas
- Sem alterações em `progress.*`, `profiles.level`, `learning_profile`, `learning_errors`, UX, telas, navegação, prompts, 20 questões ou modelo pedagógico.
- Sem Speaking, Assessment ou Fase 2F.
- Se surgir outro problema estrutural relevante, interromper e relatar antes de ampliar o escopo.
