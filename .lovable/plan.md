# Fundação pedagógica da Fase 2

## Objetivo

Adicionar uma camada pedagógica versionada e auditável em paralelo ao produto atual. Nenhuma tela, fluxo de onboarding, Final Test, cobrança, autenticação ou controle de IA será conectado ou alterado nesta etapa.

## Implementação

1. **Contratos pedagógicos centralizados**
   - Criar constantes, tipos e validadores para as sete habilidades, níveis CEFR incluindo `insufficient_evidence`, tipos de assessment, status, fontes e avaliadores.
   - Criar contratos de evidência, resultado, erro pedagógico e versões de regras/rubricas.

2. **Motor determinístico e testável**
   - Criar configuração versionada dos cortes técnicos iniciais: A1 0–29, A2 30–44, B1 45–59, B2 60–74, C1 75–89 e C2 90–100.
   - Validar score e confidence sem corrigir silenciosamente valores inválidos.
   - Consolidar evidências válidas por média ponderada usando `sample_weight`, `evidence_quality` e `source_reliability`.
   - Calcular confidence inicial, de forma isolada e configurável, combinando quantidade, qualidade, confiabilidade e consistência.
   - Retornar `score: null`, `cefr: insufficient_evidence` e `confidence: null` quando a quantidade/peso válido mínimo não for atingido.

3. **Persistência aditiva e segura**
   - Criar `assessment_sessions`, `assessment_evidence` e `assessment_skill_results`, com constraints de domínio, timestamps e vínculos compostos que impedem associar dados de usuários diferentes.
   - Referenciar usuários por `profiles.id`, preservando a estrutura de autenticação gerenciada.
   - Garantir um resultado por habilidade em cada sessão, sem impedir novas sessões históricas.
   - Criar índices para consultas por usuário, sessão, habilidade, status e data.
   - Criar trigger de `updated_at` apenas para sessões; evidências e resultados permanecem append-only para usuários autenticados.

4. **Perfil atual derivado**
   - Criar `current_skill_profile` como view, não tabela.
   - Projetar o resultado mais recente de cada habilidade a partir de sessões concluídas, preservando todo o histórico e sem tocar em `profiles.level` ou `progress`.

5. **Learning errors**
   - Adicionar referências opcionais e não destrutivas de `learning_errors` para sessão/evidência.
   - Preservar colunas, dados e política atual; não ativar detecção automática.

6. **Segurança**
   - Aplicar GRANTs mínimos e RLS em todas as novas tabelas.
   - Permitir leitura e inserção somente do próprio usuário; permitir atualização apenas da própria sessão e bloquear alteração de proprietário.
   - Não conceder acesso anônimo. Manter operações internas com `service_role` e sem novas funções `SECURITY DEFINER` desnecessárias.
   - Restringir a view ao usuário autenticado pela própria identidade da sessão.

7. **Testes e validação**
   - Adicionar Vitest e testes unitários para todas as fronteiras CEFR, scores inválidos, confidence, sete habilidades, valores CEFR aceitos e evidência insuficiente.
   - Testar agregação ponderada, consistência e invariantes de histórico em módulos puros.
   - Criar e executar uma verificação transacional no banco para provar RLS entre dois usuários, append-only e preservação de sessões anteriores, sem deixar dados de teste.
   - Executar testes, verificação de tipos, build, lint direcionado e checagens das rotas atuais essenciais.

## Detalhes técnicos

- A migration será exclusivamente aditiva; não usará `DROP`, exclusão de dados nem alteração destrutiva.
- Os domínios serão reforçados no banco por constraints e no código por schemas Zod centralizados.
- `overall_cefr` será apenas um dado da sessão; nenhum trigger ou código atualizará `profiles.level`.
- Nenhuma chamada Gemini será criada. Caso novas categorias sejam necessárias no futuro, elas serão apenas registradas no relatório.
- O relatório final listará arquivos, migration, tabelas, view, índices, políticas, contratos, fórmulas, testes, riscos, warnings e tudo que permaneceu intacto.