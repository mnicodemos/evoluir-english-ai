# Fase 2F-R.3 — Correção estrutural do Quiz

## Objetivo
Corrigir somente os três defeitos confirmados na 2F-R.2, sem executar novo Quiz/Writing real e sem alterar regras pedagógicas ou UX.

## Implementação
1. **Separar persistência de aprovação**
   - Extrair a decisão de conclusão da lição para um fluxo testável.
   - Persistir toda tentativa autoritativa na camada legada antes de avaliar o limite de 70%.
   - Manter a conclusão da lição exclusivamente para scores ≥ 70%.
   - Derivar no servidor eventuais scores de progresso apenas do resultado e dos metadados armazenados, nunca do navegador.

2. **Classificar as dez questões auditadas**
   - Aplicar `grammar` às dez questões de “Defending Your Position”.
   - Justificativa: todas avaliam estruturas gramaticais explícitas — condicionais, concessão e modal no passado.
   - Não alterar pergunta, alternativa, gabarito, dificuldade ou score.
   - Registrar a alteração por migration versionada e aplicada.

3. **Tornar ausência de mapeamento observável**
   - Detectar questão respondida sem `pedagogical_skill` válido.
   - Não criar evidência nem classificação substituta.
   - Registrar `MISSING_PEDAGOGICAL_MAPPING` em `pedagogical_dual_write_failures` pelo mecanismo idempotente atual.
   - Preservar `quiz_results`, activity e progress mesmo quando o processamento pedagógico falhar.

4. **Cobertura automatizada**
   - Quiz aprovado: persistência e conclusão.
   - Quiz reprovado: persistência ocorre e conclusão não ocorre.
   - Skill válido: evidência correta.
   - Skill ausente: nenhuma evidência falsa e falha específica.
   - Segurança dos schemas, idempotência e regras atuais continuam cobertas.

## Validação
- Suíte completa, typecheck, build e lint somente dos arquivos alterados.
- Consultas somente leitura para confirmar cobertura final e preservação dos dados históricos.
- Testes HTTP de escrita direta em `activities` e `progress`, esperando 403/42501.
- Nenhum Quiz, Writing ou outra operação real será executado.
