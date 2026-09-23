# Fase EVO 1 — presença funcional

## Alteração
- Reutilizar o busto oficial da EVO já usado na página principal, sem criar ou modificar imagens.
- Complementar o card existente de próximo passo no Dashboard com uma apresentação compacta da EVO e a frase “Seu próximo passo está aqui.”; a recomendação, o motivo e o destino continuam vindo integralmente do resultado atual do servidor.
- Introduzir a EVO no primeiro passo do onboarding com os textos curtos definidos, preservando o campo, o botão e a sequência atual.
- Apresentar a EVO novamente no passo existente de resultado do diagnóstico, antes do nível calculado, mantendo perguntas, respostas, pontuação, CEFR e persistência intactos.
- Adicionar traduções PT-BR apenas para os novos textos fixos de interface.

## Composição e acessibilidade
- Usar enquadramento de busto compacto no celular e ligeiramente maior no desktop, sem dominar os cards.
- Manter os componentes, tokens de cor, contraste e espaçamento do produto.
- Tratar a imagem como conteúdo visual com texto alternativo adequado; nenhum novo controle ou interação será criado.

## Validação
- Cobrir a presença da EVO e dos textos nos três contextos, confirmando que o próximo passo continua usando o dado real já carregado e que o diagnóstico mantém o cálculo existente.
- Executar testes existentes, build, TypeScript, lint e formatação.
- Verificar Dashboard e onboarding em 320, 375, 390, 414, 768, 1280 e 1440 px, incluindo contraste, cortes, sobreposição, CTA, console e rolagem horizontal.

## Limites preservados
- Nenhuma alteração na página principal, Landing, banco, APIs, IA, prompts, autenticação, billing ou regras pedagógicas.
- Nenhuma nova recomendação, score, nível, evidência, persistência ou sistema de avatar.
