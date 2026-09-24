# Padronização global da identidade visual Evoluir+

## Escopo
- Consolidar a personagem EVO no `EvoGuide` e no PNG oficial transparente já adotado, preservando integralmente suas cores, proporções e apresentação atual.
- Consolidar o símbolo Evoluir+ no componente `Logo`, usando como fonte oficial a versão enviada com fundo branco e composição circular, sem alterar layouts ou espaçamentos das páginas.
- Manter o nome visível da marca no componente `BrandName`, com apenas o “+” no verde oficial da EVO já registrado no design system (`rgb(0 245 206)`).
- Aplicar o mesmo símbolo oficial ao favicon e acrescentar os ícones/manifesto necessários para navegadores desktop e mobile.
- Preservar nos PDFs o logo compartilhado e o desenho segmentado do nome, no qual somente o “+” recebe o verde oficial.

## Auditoria confirmada
- A EVO funcional já está centralizada em `EvoGuide` e usa o PNG oficial transparente em Dashboard/Next Step, diagnóstico, resultado, abertura da aula, Smart Review, Progress e AI Teacher.
- A Landing mantém uma apresentação própria da mesma EVO em corpo inteiro e busto; essas imagens são transparentes ou composições já aprovadas e não serão recriadas.
- O símbolo da marca já é centralizado em `Logo`; o nome estilizado já é centralizado em `BrandName`.
- Os relatórios compartilham `pdfTheme`/`pdfWorkbook`; o logo e o “+” verde já são aplicados por essas bases.
- Existe favicon PNG, mas não há manifesto nem ícone específico para instalação em mobile.

## Implementação
- Preparar a imagem oficial enviada para uso digital circular com fundo branco, apenas removendo margens excedentes e preservando o desenho e suas proporções; substituir a origem de `Logo` sem alterar seus usos.
- Gerar favicon e ícones de navegador a partir da mesma fonte oficial, com enquadramento consistente e sem deformação; registrar favicon, ícone Apple e manifesto no cabeçalho global.
- Manter o token `brand-green` como fonte única do “+” visível e o mesmo valor em PDFs.
- Atualizar o checklist do projeto, sem tocar em lógica, rotas, dados, IA, autenticação, pedagogia ou conteúdo.

## Validação
- Conferir Landing, autenticação, onboarding e área autenticada em 320, 375, 390, 414, 768, 1280 e 1440 px, sem corte, deformação, sobreposição ou rolagem horizontal.
- Confirmar que a EVO usa somente os ativos oficiais já aprovados e não se repete fora dos pontos existentes.
- Gerar amostras das capas PDF e verificar visualmente logo e “+” verde.
- Executar os testes existentes, build, TypeScript, lint e formatação dos arquivos alterados.
- Confirmar 0 chamadas e 0 créditos adicionais de IA.
