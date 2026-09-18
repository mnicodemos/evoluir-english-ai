# Fase 2C — Dual Write de evidências pedagógicas

## Conflitos encontrados na inspeção

- O Quiz salva o resultado e as respostas, mas os detalhes não guardam o ID nem uma habilidade pedagógica da questão. As questões atuais usam apenas `multiple_choice`; associar automaticamente Grammar ou Vocabulary pelo texto, ou pelo skill da lição, inventaria uma classificação — inclusive porque as lições atuais estão marcadas como Reading/Listening enquanto várias perguntas observadas são gramaticais.
- Writing não possui entidade persistida para a submissão: o texto, o feedback completo e os três subscores existem somente durante a tela; apenas a média é gravada em `activities/progress`. Para cumprir rastreabilidade e preservar o original, será necessária uma estrutura append-only específica.
- `clarity` não é uma das sete skills. Ela será preservada como evidência da skill `writing`, subskill `clarity`; Grammar e Vocabulary continuarão em suas próprias skills.
- A evidência atual não possui polaridade, tipo específico do sinal nem identificador do item. Esses campos precisam ser adicionados de forma opcional para garantir rastreabilidade e idempotência sem reescrever dados anteriores.

## Implementação

1. **Migração aditiva e segura**
   - Criar `writing_submissions` append-only, privada por usuário, contendo prompt, texto original e avaliação original estruturada, sem exposição pública.
   - Acrescentar à evidência campos opcionais para `evidence_type`, `polarity`, `source_item_id` e metadados mínimos não sensíveis.
   - Acrescentar à sessão técnica a origem operacional e uma chave única por usuário/origem.
   - Criar unicidade idempotente de evidência por usuário, origem, item, skill, subskill e tipo.
   - Criar registro privado de falhas/retries do Dual Write, sem mensagens sensíveis.
   - Acrescentar `pedagogical_skill` nullable às questões; não classificar por heurística. Somente questões explicitamente sustentadas produzirão evidência.
   - Manter grants mínimos, RLS por `auth.uid()`, FKs compostas de proprietário e nenhuma permissão anônima.

2. **Ponte autenticada de Dual Write**
   - Criar funções autenticadas de servidor usando o cliente do próprio usuário e RLS, sem acesso administrativo.
   - Para Quiz, validar que o `quiz_result` pertence ao usuário, ler os IDs de questão persistidos e gerar sinais determinísticos 100/0 apenas quando `pedagogical_skill` estiver preenchido.
   - Para Writing, persistir primeiro a submissão original e o feedback já validado; gerar evidências Gemini para Grammar, Vocabulary e Writing/Clarity sem nova chamada de IA.
   - Criar/reutilizar uma sessão técnica `progress_check` por resultado operacional, agregar todo o histórico válido da skill com `aggregateSkillEvidence`, inserir snapshots e concluir a sessão.
   - Não tocar em `progress`, `profiles.level`, regras CEFR ou confidence; usar exclusivamente os módulos existentes.

3. **Integração sem regressão**
   - Fazer o Quiz continuar salvando `quiz_results` primeiro e retornar seu ID; disparar o Dual Write depois, em bloco isolado que nunca rejeita o fluxo original.
   - Fazer Writing continuar executando a avaliação, atividade e progresso atuais; depois registrar a submissão e o Dual Write, também sem propagar falha técnica à tela.
   - Preservar prompts, navegação, componentes e mensagens visíveis.
   - Guardar IDs das perguntas nos detalhes futuros do Quiz, mantendo os campos atuais.

4. **Erros e reprocessamento**
   - Registrar falhas sanitizadas por origem e etapa, com contador e status pendente/concluído.
   - Repetições reutilizarão a mesma sessão e a constraint idempotente; conflitos serão tratados como sucesso já processado.
   - Não criar `learning_errors` quando o resultado existente não trouxer erro estruturado suficiente. Nesta fase, apenas manter a referência pronta e não inferir taxonomia.

5. **Testes e validação**
   - Testar mapeamento positivo/negativo, Grammar/Vocabulary explícitos, ausência de classificação inventada, Writing Grammar/Vocabulary/Clarity, preservação do original e idempotência.
   - Testar que falhas da ponte são absorvidas depois do salvamento operacional e que retries não duplicam.
   - Validar no banco RLS entre dois usuários, append-only, unicidade, histórico e projeção atual.
   - Executar testes, typecheck, lint direcionado, build e fluxos autenticados de Quiz/Writing sem mudanças visuais.

## Fora do escopo

- Assessment completo, Speaking, Listening, Pronunciation, novo dashboard, novas telas, novo scoring, novo CEFR, alteração de progressão ou mudança de nível.