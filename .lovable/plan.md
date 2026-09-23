# Padronização global da cor da marca Evoluir+

## Objetivo
Aplicar o verde já presente na identidade visual da EVO somente ao sinal “+” do nome visível da marca e ao círculo superior do símbolo oficial, sem alterar dimensões, posições, textos ou comportamento.

## Implementação
- Preservar o desenho e a transparência do símbolo atual, gerando uma variante visual idêntica na qual apenas o círculo superior recebe o verde exato identificado na EVO.
- Atualizar o componente compartilhado `Logo` para usar essa variante; todas as páginas que já reutilizam o componente serão atualizadas automaticamente, inclusive documentos que carregam a mesma imagem.
- Criar uma apresentação compartilhada do nome da marca que mantém o texto “Evoluir+ English AI” intacto e colore somente o caractere “+”; substituir apenas as ocorrências visuais do nome junto ao símbolo.
- Não alterar menções editoriais, metadados, mensagens, conteúdo, EVO ou qualquer lógica.

## Validação
- Conferir as páginas públicas, autenticação, diagnóstico e área autenticada em 320, 375, 390, 414, 768, 1280 e 1440 px.
- Confirmar que símbolo e nome preservam tamanho, alinhamento e layout, e que o “+” e o círculo superior usam a mesma cor.
- Executar testes existentes, build, TypeScript, lint e formatação somente dos arquivos alterados.
- Confirmar ausência de chamadas de IA e de alterações em banco, rotas ou comportamento.

## Detalhes técnicos
- Origem compartilhada atual: `Logo`, baseado em uma imagem PNG transparente.
- O nome visível é texto separado em alguns pontos; por isso, a padronização textual será reutilizável e limitada às assinaturas oficiais ao lado do símbolo.
- Nenhuma migration, endpoint, consulta, estado ou dependência será criada.
