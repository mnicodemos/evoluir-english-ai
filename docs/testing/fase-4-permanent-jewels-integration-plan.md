# Fase 4 — Plano de testes de integração das joias permanentes

## Objetivo

Validar o comportamento real dos gatilhos PostgreSQL de concessão de joias e ciclos de Diamante em um banco de testes descartável, sem tocar em produção e sem alterar as regras já aprovadas.

## Estado da preparação

- [x] Inspecionadas as migrations `0090_permanent_jewel_awards.sql` e `0099_diamond_cycles.sql`.
- [x] Inspecionados os testes unitários de `diamondCycles` e `streakFreeze`.
- [x] Confirmado que o Vitest coleta testes TypeScript, mas não há configuração explícita de conexão PostgreSQL de teste no `vitest.config.ts`.
- [x] Criada esta especificação em branch isolada.
- [x] Provisionar banco PostgreSQL descartável (PostgreSQL 16) no workflow de CI.
- [x] Aplicar migrations reais 0038, 0042, 0090 e 0099 somente nesse banco descartável.
- [x] Implementar assertions SQL para Freeze disponível/consumido, ausência de estudo artificial e rollback atômico.
- [ ] Aguardar CI do PR e anexar evidência PASS do workflow e descarte automático do banco.

## Regras que os testes devem preservar

1. Marcos atuais: Bronze 1; Silver 7; Gold 14; Sapphire 21; Ruby 28; Emerald 35; Amethyst 42; Pearl 49; Obsidian 56; Diamond 63 dias.
2. Joias são permanentes e append-only para o fluxo normal da aplicação.
3. Concessão ocorre somente na subida válida de `profiles.streak_days`.
4. Saltos de streak concedem todos os marcos cruzados.
5. Repetição de atualização não duplica concessões.
6. Reset ou queda do streak não remove concessões já existentes.
7. Ciclos de Diamante são concedidos em 126, 189, 252… dias, sem substituir a joia Diamond.
8. Freeze protege a sequência conforme a regra existente, mas não insere um dia artificial em `study_days`.
9. Não modificar XP, Weekly League, sincronização entre dispositivos, fórmulas ou dados históricos.

## Matriz de integração PostgreSQL

| ID | Cenário | Preparação/ação | Resultado esperado |
|---|---|---|---|
| JWL-01 | Primeiro marco | Atualizar streak de 0 para 1 | Uma concessão Bronze |
| JWL-02 | Marco exato | Atualizar 6 para 7 | Uma concessão Silver |
| JWL-03 | Salto de marcos | Atualizar 6 para 21 | Silver, Gold e Sapphire concedidas |
| JWL-04 | Idempotência | Repetir atualização sem novo avanço e reexecutar avanço já coberto | Nenhuma linha duplicada |
| JWL-05 | Permanência | Conceder até 21 e depois reduzir/resetar streak | As concessões permanecem |
| JWL-06 | Diamond | Atualizar 62 para 63 | Diamond concedido uma única vez |
| DIA-01 | Ciclo 2 | Atualizar 125 para 126 | Ciclo 2 concedido |
| DIA-02 | Salto de ciclos | Atualizar 126 para 252 | Ciclos 3 e 4 concedidos, sem duplicar ciclo 2 |
| DIA-03 | Idempotência dos ciclos | Repetir atualização no mesmo valor | Nenhum ciclo duplicado |
| DIA-04 | Permanência dos ciclos | Reduzir/resetar streak após ciclos concedidos | Ciclos permanecem |
| FRZ-01 | Freeze não é estudo | Executar `credit_study_day` com evidência válida e um dia perdido | Proteção da sequência sem nova linha artificial em `study_days` |
| FRZ-02 | Limite semanal | Executar o fluxo com Freeze já usado na mesma semana | Sequência não é protegida uma segunda vez e a data anterior permanece |
| TX-01 | Atomicidade | Forçar rollback após cruzar marco de joia | Streak e concessões sofrem rollback juntas |

## Pré-condições do ambiente

- Banco PostgreSQL temporário e exclusivo para testes; nunca reutilizar a URL de produção.
- Credenciais de teste com privilégios suficientes para aplicar migrations e inspecionar triggers.
- Esquema construído a partir das migrations do projeto na ordem oficial, incluindo as dependências de `profiles` e `study_days`.
- Usuários de fixture sintéticos, criados e removidos dentro da transação ou do ciclo de vida do banco descartável.
- Execução bloqueada se a URL apontar para produção ou para um host não explicitamente autorizado como ambiente de teste.
- Cada cenário deve ser isolado e repetir-se sem depender da ordem dos demais.

## Evidências obrigatórias

Para cada cenário, registrar:
- identificador do teste;
- streak anterior e posterior;
- linhas de `permanent_jewel_awards` e `diamond_cycles` antes/depois;
- contagem de `study_days` quando aplicável;
- resultado PASS/FAIL;
- confirmação de que o banco era descartável e não era produção.

## Fora do escopo

Não alterar migrations existentes, regras de negócio, dados de alunos, histórico de joias, UI, XP, Weekly League ou sincronização entre dispositivos. Não executar backfill em produção. A implementação do harness e os testes executáveis serão feitos somente após identificar e validar o provisionamento do banco descartável.
