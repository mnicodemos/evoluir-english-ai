# Páginas públicas de Termos e Privacidade

## Objetivo
Criar duas páginas jurídicas públicas, sem login e sem a barra lateral do app:

- `/terms` — Termos de Uso
- `/privacy` — Política de Privacidade

## Implementação

1. Criar um componente compartilhado apenas para a apresentação dos documentos, usando o tema escuro e a tipografia existentes, largura de leitura `max-w-3xl`, cabeçalho com título, data de atualização e ação “Voltar”, além do rodapé padrão.
2. Criar as duas rotas públicas com o conteúdo oficial integral em português e uma tradução fiel em inglês. O texto exibido acompanhará o idioma salvo no app; a versão inglesa incluirá a nota de prevalência da versão portuguesa.
3. Adicionar metadados próprios em cada rota: título, descrição, Open Graph e Twitter Card.
4. Substituir os quatro links vazios de Termos e Privacidade no rodapé pelas rotas novas, preservando as variantes minimal e completa.
5. Na criação de conta, inserir abaixo do botão a frase de concordância, com links para Termos e Privacidade. Ela só aparecerá no modo de cadastro e acompanhará o idioma da tela.
6. Validar acesso público, troca de idioma, ação Voltar, links do rodapé e apresentação em celular e desktop.

## Limites
- Nenhuma mudança em banco, autenticação, dados, consultas, APIs ou telas autenticadas.
- Nenhuma alteração no conteúdo oficial em português fornecido.
