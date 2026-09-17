# Corrigir falhas de SEO

## Alterações no site
- Remover do cabeçalho global os títulos, descrições e tags sociais duplicados, mantendo somente configurações realmente globais.
- Adicionar URL canônica e URL social autorreferentes à página pública inicial.
- Marcar login e toda a área autenticada como não indexáveis, pois são páginas pessoais e não devem aparecer na busca.
- Criar `/sitemap.xml` com a página pública inicial e referenciá-lo em `robots.txt` usando o domínio oficial.

## Google Search Console
- Conectar uma conta Google Search Console ao projeto.
- Solicitar a tag de verificação da propriedade `https://evoluirmaisenglishai.com/` e adicioná-la ao cabeçalho da página inicial.
- Publicar as correções após a aprovação solicitada no chat.
- Confirmar a tag no site publicado, verificar a propriedade e enviar o sitemap ao Google.

## Verificação
- Confirmar que o site compila sem erros.
- Verificar no preview que `/sitemap.xml` contém apenas URLs públicas e que `robots.txt` aponta para ele.
- Marcar como corrigidos somente os alertas totalmente resolvidos; a próxima varredura dará o veredito final.

## Detalhes técnicos
- O sitemap será gerado pela lista tipada de rotas do TanStack, com decisões explícitas de inclusão/exclusão.
- A área autenticada será excluída como uma subárvore inteira; rotas de API, autenticação e ferramentas internas também serão excluídas.
- Não será adicionado `lastmod` artificial, pois não há uma data editorial autoritativa por página.
