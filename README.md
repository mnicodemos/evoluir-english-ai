# Evoluir English AI

Crie um aplicativo SaaS chamado:

ENGLISH COACH AI PRO

Um aplicativo inteligente de aprendizado de inglês para brasileiros de nível intermediário (B1/B2), utilizando Inteligência Artificial como professor particular personalizado.

O objetivo principal é ajudar usuários adultos e profissionais a desenvolverem:

- Conversação

- Vocabulário

- Listening

- Escrita

- Inglês profissional

- Confiança para falar

O aplicativo deve parecer um produto premium de uma startup de tecnologia educacional.

====================================================

## VISÃO DO PRODUTO

Criar um "AI English Coach" que acompanha o aluno diariamente.

A inteligência artificial deve:

- conhecer o nível do aluno;

- entender seus objetivos;

- identificar dificuldades;

- criar atividades personalizadas;

- corrigir erros;

- acompanhar evolução.

O aplicativo deve funcionar como um treinador pessoal de inglês.

====================================================

# PÚBLICO-ALVO

Usuários:

- brasileiros;

- adultos;

- profissionais;

- estudantes universitários;

- pessoas buscando crescimento profissional.

Principais objetivos:

- conseguir conversar em inglês;

- participar de reuniões;

- fazer entrevistas;

- viajar;

- trabalhar em empresas globais.

====================================================

# POSICIONAMENTO

Não criar apenas um aplicativo de exercícios.

Criar uma experiência:

"Seu professor particular de inglês usando Inteligência Artificial."

====================================================

# FASE 1 - MVP

Construir primeiro somente as funcionalidades essenciais.

Prioridade:

1. Autenticação

2. Perfil do aluno

3. Diagnóstico inicial

4. Dashboard personalizado

5. Professor IA de conversação

6. Correção de textos

7. Vocabulário inteligente

8. Evolução do aluno

Não criar funcionalidades avançadas ainda.

Preparar arquitetura para expansão futura.

====================================================

# EXPERIÊNCIA DO USUÁRIO

## Jornada Novo Usuário

Fluxo:

1. Usuário cria conta

2. Realiza onboarding:

Perguntar:

Nome:

Objetivo principal:

- Conversação

- Trabalho

- Viagem

- Entrevista

- Certificação

Nível atual:

- Básico

- Intermediário

- Avançado

Tempo disponível:

- 10 minutos/dia

- 20 minutos/dia

- 30 minutos/dia

3. Sistema cria perfil de aprendizado.

4. Usuário recebe plano personalizado.

5. Usuário realiza primeira atividade.

6. IA fornece feedback.

====================================================

# DESIGN / UI UX

Criar uma interface:

- moderna;

- premium;

- minimalista;

- profissional;

- mobile first.

Inspirado em:

- Duolingo

- Speak AI

- Notion

- Linear

Características:

- cards modernos;

- gráficos;

- animações suaves;

- navegação simples.

Paleta:

Azul escuro:

tecnologia e confiança

Verde:

crescimento

Branco:

clareza

Tipografia:

Moderna e limpa.

====================================================

# TELAS PRINCIPAIS

## 1. Landing Page

Criar:

Título:

"Domine o inglês com seu professor particular de IA."

Subtítulo:

"Pratique conversação, melhore sua pronúncia e evolua todos os dias."

CTA:

"Começar minha evolução"

Seções:

- benefícios;

- como funciona;

- funcionalidades;

- planos futuros.

====================================================

# 2. LOGIN

Criar:

- Login Google

- Email/Senha

- Cadastro

====================================================

# 3. DASHBOARD

Criar painel:

Olá, [Nome]

Seu progresso:

Speaking

78%

Vocabulary

85%

Grammar

72%

Listening

70%

Mostrar:

Sequência:

🔥 15 dias estudando

Meta diária:

"Praticar 15 minutos de inglês"

Cards:

Conversação IA

Vocabulário

Writing

Meu progresso

====================================================

# 4. AI ENGLISH COACH

Criar chatbot inteligente.

A IA deve assumir:

"Você é um professor de inglês certificado CELTA especializado em alunos brasileiros intermediários."

Regras:

- conversar em inglês;

- corrigir erros importantes;

- não interromper constantemente;

- incentivar comunicação;

- explicar gramática de forma simples;

- sugerir frases naturais usadas por nativos.

Cenários:

## Everyday English

Conversas:

- família

- amigos

- rotina

## Professional English

- reuniões;

- apresentações;

- networking;

- entrevistas.

## Travel English

- aeroporto;

- hotel;

- restaurante.

Após cada conversa gerar:

Relatório:

Fluency:

0-100

Grammar:

0-100

Vocabulary:

0-100

Improvement suggestions.

====================================================

# 5. WRITING AI CORRECTOR

Criar área:

Usuário escreve um texto.

Exemplo:

"Describe your professional experience."

IA retorna:

Texto corrigido:

Versão natural:

Explicação dos erros:

Sugestões:

Nota:

Grammar:

85%

Vocabulary:

80%

Clarity:

90%

====================================================

# 6. VOCABULARY BUILDER

Criar sistema inteligente.

Cada palavra possui:

Word:

Meaning:

Pronunciation:

Example:

Difficulty:

Exemplo:

Figure out

Descobrir / entender

Example:

"I need to figure out this problem."

Criar:

- palavras aprendidas;

- palavras difíceis;

- revisão automática.

====================================================

# 7. PROGRESS ANALYTICS

Criar dashboard:

Mostrar:

Evolução semanal:

Speaking

Vocabulary

Grammar

Listening

Mostrar:

Pontos fortes:

Pontos de melhoria:

Erros frequentes:

====================================================

# INTELIGÊNCIA ARTIFICIAL

Criar camada AI Coach.

A IA deve considerar:

- nível do usuário;

- histórico;

- erros anteriores;

- vocabulário aprendido;

- objetivos.

Cada interação deve alimentar o perfil do aluno.

====================================================

# BANCO DE DADOS

Criar Supabase Database:

TABLE USERS

id

name

email

level

goal

created_at

TABLE LEARNING_PROFILE

id

user_id

strengths

weaknesses

common_errors

learning_preferences

TABLE VOCABULARY

id

word

translation

example

difficulty

TABLE USER_VOCABULARY

user_id

word_id

mastery_level

TABLE AI_CONVERSATIONS

id

user_id

topic

messages

score

feedback

TABLE PROGRESS

id

user_id

speaking_score

grammar_score

listening_score

vocabulary_score

TABLE ACTIVITIES

id

user_id

activity_type

duration

score

date

====================================================

# SEGURANÇA

Implementar:

- Supabase Auth

- Row Level Security

- usuários somente acessam seus dados

- API Keys protegidas no backend

- Secrets protegidos

Nunca expor chaves sensíveis no frontend.

====================================================

# ESTRUTURA FUTURA

Preparar arquitetura para:

FASE 2:

- reconhecimento de voz;

- análise de pronúncia;

- áudio;

- avatar IA;

- notificações.

FASE 3:

- assinatura Premium;

- Stripe;

- planos Free/Premium.

====================================================

# CRITÉRIOS DE ACEITE DO MVP

O aplicativo será considerado pronto quando:

✓ Usuário consegue criar conta

✓ Realiza diagnóstico inicial

✓ Recebe plano personalizado

✓ Conversa com IA

✓ Recebe correção

✓ Aprende vocabulário

✓ Visualiza evolução

✓ Funciona perfeitamente em celular

====================================================

# IMPORTANTE

Antes de iniciar a construção:

Analise a arquitetura proposta.

Caso existam dúvidas críticas sobre:

- fluxo do usuário;

- banco de dados;

- experiência;

- funcionalidades;

faça perguntas antes de gerar código.

Construir o aplicativo por componentes e etapas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evoluirmaisenglishai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0199ddb5-b932-453d-8d8c-3ac3d1504f30).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
