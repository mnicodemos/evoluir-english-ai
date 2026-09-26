# Compatibilidade vertical do Dashboard

## Objetivo
Manter o Dashboard inteiro visível no Chrome e Brave, sem alterar o design, a altura do card EVO, a estrutura ou as proporções atuais.

## Alterações
- Trocar o cálculo desktop baseado em `100vh` por viewport dinâmica (`100dvh`), com fallback compatível.
- Reservar aproximadamente 50 px de folga vertical dentro da área disponível do Dashboard.
- Aplicar o ajuste somente ao modo desktop do Dashboard, preservando o comportamento mobile e as demais telas.
- Manter as alturas fixas já aprovadas e permitir que apenas as faixas flexíveis absorvam pequenas diferenças entre navegadores.

## Validação
- Conferir ausência de scroll vertical e preservação visual em Chrome/Chromium nas dimensões desktop relevantes.
- Confirmar que o card EVO mantém a mesma altura e que não há cortes ou sobreposição.
- Verificar o estado final da compilação.

## Detalhes técnicos
- O contêiner principal usará uma variável CSS de viewport com fallback `vh` e preferência por `dvh` quando suportado.
- O orçamento vertical considerará o espaçamento externo atual e uma margem adicional de segurança próxima de 50 px.
