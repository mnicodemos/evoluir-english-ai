# Gerar o Vocabulary ao concluir cada lição

## Escopo
- Disparar a geração do novo lote automaticamente somente depois que a lição for realmente concluída com aprovação no quiz.
- Reutilizar a função atual de Vocabulary, sem criar outra geração, prompt, regra pedagógica ou estrutura de dados.
- Atualizar o estado compartilhado quando as palavras forem salvas, para o ponto verde aparecer no Dashboard sem o aluno abrir o Vocabulary.
- Em caso de falha, preservar a lição concluída, impedir repetição automática em loop e manter o botão existente de tentativa manual no Vocabulary.
- Corrigir o retry ampliado já existente para realmente usar sua variação prevista, evitando novo lote vazio quando palavras literais se esgotarem.

## Validação
- Lição aprovada pela primeira vez → palavras salvas automaticamente → ponto verde visível.
- Lição reprovada ou apenas revisitada → nenhuma nova geração indevida.
- Falha de geração → conclusão preservada, sem ponto verde e sem repetição automática.
- Tentativa manual existente continua funcionando.
- Executar testes focados, testes existentes e validação do projeto.

## Detalhes técnicos
- Integrar no fluxo atual de conclusão da aula e invalidar as consultas já usadas pelo indicador.
- Não alterar banco, migrations, CEFR, mastery, evidências, progressão, prompts principais, autenticação, quotas ou billing.
