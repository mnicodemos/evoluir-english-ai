# Fase 2H — Proteção do gabarito do Quiz

## Objetivo
Impedir que clientes autenticados leiam `quizzes.correct_answer` antes da submissão, mantendo o Quiz, o cálculo autoritativo e a correção pós-submissão inalterados.

## Implementação
- Criar uma migration dedicada que revoga leitura ampla de `quizzes` para clientes e concede `SELECT` somente nas colunas necessárias ao Quiz, excluindo `correct_answer`.
- Preservar a política de leitura de linhas existente e o acesso integral do servidor confiável.
- Não alterar questões, respostas, prompts, pontuações, fundação pedagógica, Writing ou telas.
- Adicionar testes focados no contrato público sem gabarito, cálculo autoritativo com gabarito interno e retorno de correção somente após submissão.

## Validação
- Confirmar no banco que `authenticated` não possui privilégio de leitura sobre `correct_answer`, inclusive em seleção explícita, e que as colunas públicas continuam acessíveis.
- Confirmar que `service_role` mantém acesso ao gabarito.
- Executar testes existentes, testes da Fase 2H, typecheck, lint apenas dos arquivos alterados e build.
- Verificar que nenhuma linha ou resultado histórico foi criado, alterado ou apagado.

## Limites
Não executar Quiz real, Writing ou a Fase 2F-R. Se a proteção exigir mudança estrutural fora desse escopo, interromper e relatar.
