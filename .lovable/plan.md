# Acelerar o áudio de palavras e frases

## Objetivo
Reduzir a espera até o áudio começar, mantendo a voz escolhida e o uso da API Google Gemini já conectada ao projeto.

## Alterações
- Fazer o servidor repassar o áudio à medida que o Gemini o produz, em vez de esperar o arquivo inteiro ficar pronto.
- Iniciar a reprodução assim que o primeiro trecho chegar ao navegador.
- Manter o cache atual para repetições instantâneas da mesma frase ou palavra.
- Preservar a voz do navegador apenas como alternativa quando o serviço de áudio falhar.

## Validação
- Confirmar que o projeto compila sem erros.
- Testar no navegador que o áudio começa durante o recebimento e que uma segunda reprodução usa o cache.
