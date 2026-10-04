# Notificações no celular para atividades novas

## O que o aluno vai ver
- No menu lateral (celular e desktop), um item "Ativar notificações". Ao tocar, o celular pede permissão.
- Avisos que aparecem na tela do celular, mesmo com o app fechado:
  - "Nova Escuta liberada" quando uma lição concluída libera uma nova rodada de Listening.
  - "Novas frases de Escrita" quando a rodada de Writing é liberada.
  - "Vocabulário novo pronto" quando o grupo de 10 palavras é salvo.
  - Lembrete diário (ex.: 19h, horário de São Paulo) só se o aluno ainda não estudou hoje, para não perder o Streak.
- Tocar no aviso abre a página certa (Listening, Writing, Vocabulary ou Dashboard).
- No máximo 1 aviso de cada tipo por dia, para não incomodar.
- iPhone: só funciona com o app instalado na tela inicial (limitação da Apple). Vamos mostrar essa orientação.
- No preview do editor o pedido de permissão não aparece; o teste é feito no app publicado.

## O que você precisa fazer
- Conectar o Firebase Cloud Messaging (serviço gratuito do Google que entrega os avisos). Vou abrir o cartão de conexão; é preciso marcar "Include web push".

## Detalhes técnicos
- Conector `firebase_messaging` (web push, VAPID). `public/firebase-messaging-sw.js` + clique na notificação abre `data.path`.
- Nova tabela `push_subscriptions` (user_id, token único, plataforma, criado/atualizado) com GRANTs e RLS por `auth.uid()`; tabela `push_notification_log` (user_id, tipo, dia) para limitar 1 aviso/tipo/dia — só service_role.
- Server functions autenticadas: `registerPushToken`, `unregisterPushToken`.
- Envio server-side (`push.server.ts`) via gateway; tokens com UNREGISTERED são apagados.
- Disparos:
  - Lição concluída → avisos de Listening/Writing (regra de rodada já existente, baseada em lições concluídas, calculada no servidor).
  - Batch de vocabulário salvo → aviso de Vocabulary (no fluxo de geração existente, sem mudar a lógica).
  - Lembrete diário: rota `/api/public/cron/daily-reminder` protegida por segredo, chamada por pg_cron às 22:00 UTC; consulta as mesmas evidências de `credit_study_day`.
- Nenhuma mudança na lógica pedagógica, Streak ou indicadores verdes atuais.
