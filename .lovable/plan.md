# Mover o acesso administrativo para o perfil

## Objetivo
Retirar a engrenagem de administrador do cabeçalho e da barra lateral e exibi-la somente dentro da janela de perfil do administrador autorizado.

## Implementação
- Reutilizar o painel administrativo e sua validação atual, sem alterar permissões ou dados.
- Adaptar o acesso administrativo para funcionar como uma ação interna da janela de perfil.
- Remover as duas ocorrências externas da engrenagem no menu desktop e no cabeçalho móvel.
- Manter o acesso invisível para usuários que não sejam administradores.

## Validação
- Confirmar que o administrador abre o painel pela janela de perfil.
- Confirmar que usuários comuns não veem a ação administrativa.
- Verificar o funcionamento em telas pequenas e grandes e validar a compilação.
