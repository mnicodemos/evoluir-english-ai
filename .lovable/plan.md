# Fase 2E — Hardening da Fundação Pedagógica

## Objetivo
Fechar apenas os riscos estruturais encontrados na Fase 2D, mantendo Quiz, Writing, telas, prompts, progressão e fontes de verdade atuais sem mudança visível.

## Implementação

### 1. Autoria confiável e RLS
- Manter leitura dos próprios registros pedagógicos.
- Revogar do papel autenticado as escritas diretas em sessões, evidências, resultados derivados, snapshots de Writing e registros de falha; remover as policies de escrita correspondentes.
- Executar o Dual Write em função autenticada, derivando `user_id` exclusivamente da sessão validada e carregando o cliente privilegiado somente dentro do servidor.
- Não aceitar skill, score, confidence ou CEFR vindos do cliente. Quiz será derivado das questões e respostas persistidas; Writing será derivado do feedback produzido pelo fluxo Gemini autenticado.
- Preservar RLS, vínculos compostos de usuário/sessão e leitura isolada por usuário.

### 2. Identidade estável da operação
- Criar uma identidade de tentativa antes da operação e conservá-la durante envio, refresh e retry.
- Quiz: reutilizar a identidade persistida da tentativa para gravar uma única operação funcional; “Refazer” inicia explicitamente uma identidade nova.
- Writing: manter uma identidade por análise desde antes da chamada ao Gemini até a conclusão; retry reutiliza essa identidade, enquanto uma nova análise recebe outra.
- Adicionar apenas as colunas/índices mínimos necessários para ligar a identidade estável à origem operacional e impedir duplicação.

### 3. Ponte confiável e idempotente
- Consolidar o processamento pedagógico em serviço interno compartilhado, não chamável com valores pedagógicos arbitrários.
- Usar IDs determinísticos e constraints existentes para sessão, evidência e resultado; conflitos válidos serão tratados como operação já processada.
- Validar que uma identidade já associada a outro conteúdo não seja silenciosamente reutilizada.
- Manter o resultado funcional salvo mesmo quando a camada pedagógica falhar.

### 4. Retry e diagnóstico
- Evoluir o registro de falhas para estados rastreáveis de processamento, conclusão e falha, com contador de tentativas, último erro sanitizado e timestamps.
- Implementar retry interno limitado e reprocessamento seguro a partir da operação original persistida, sem reenviar scores/CEFR pelo frontend.
- Registrar a etapa real com códigos estruturados: autorização, validação, sessão, evidência, agregação, skill result, CEFR, finalização e conflito de idempotência.
- Evitar estados ambíguos; falhas parciais permanecerão reentrantes e serão concluídas sem duplicar histórico.

### 5. Imutabilidade e observabilidade
- Preservar sessões concluídas e tornar evidências/resultados derivados não graváveis nem alteráveis pelo cliente.
- Manter correções como novo reprocessamento explícito/versionado, nunca sobrescrita silenciosa.
- Garantir rastreabilidade `operação → sessão → evidência → agregação → skill result → CEFR` pelos IDs e registros estruturados, sem dashboard novo.

### 6. Testes obrigatórios
- Testes unitários de identidade, códigos de falha, retry, falha parcial e idempotência.
- Testes autenticados pela API: cliente não insere evidência/resultado/CEFR/confidence, não altera derivados, não acessa outro usuário; servidor confiável continua gravando para o proprietário autenticado.
- Testes de duas execuções, refresh/retry e recuperação após falha sem duplicidade.
- Confirmar separadamente o caminho autenticado real e rejeição de qualquer owner informado pelo chamador.
- Executar suíte existente, lint, typecheck e build.

## Fora de escopo
- Nenhuma tela, UX, navegação, prompt, Dashboard, Final Test ou regra de progressão será alterada.
- Nenhum Assessment novo, Speaking, Listening, Pronunciation ou Fase 2F.
- Nenhuma das 20 questões será modificada; os achados pedagógicos permanecerão apenas documentados.
- Nenhum dado artificial permanente será criado.

## Relatório final
Documentar migrations, grants/policies antes e depois, identidade de cada operação, estados/códigos de retry, testes e evidências de não regressão. Se surgir outro problema estrutural não previsto, interromper antes de corrigi-lo e apresentar impacto, causa, risco e recomendação.
