# WhatsApp study integration — foundation and AI Teacher adapter

This phase prepares the official Meta WhatsApp Business Platform / Cloud API connection. It is deliberately **not considered active** until deployment secrets are configured and a real Meta webhook/send test passes.

## Included

- Public webhook endpoint: `/api/public/whatsapp/webhook`
- Meta GET verification using `WHATSAPP_VERIFY_TOKEN`
- POST request verification against the exact raw body using `X-Hub-Signature-256` and `WHATSAPP_APP_SECRET`
- Server-side outbound text messages through the configured Graph API version
- One-time account-link code (10-minute expiry, max 5 generated per account per hour)
- Phone ownership link only after the WhatsApp sender sends `CONECTAR 123456` (or `CONNECT 123456`)
- Service-role-only connection, link-code and webhook idempotency tables
- Tests for signature verification, phone normalization and inbound payload parsing
- Linked text messages can call the existing AI Teacher server pipeline when the explicit study feature flag is enabled

## Required deployment secrets

Configure these as server-side secrets in the deployment environment. Never add real values to `.env`, source control, or browser variables.

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION` — set to the Graph API version enabled for the Meta app; this project intentionally does not guess it.
- `WHATSAPP_BUSINESS_PHONE_NUMBER` — the public display number students should message, in international format; it is shown in the authenticated profile settings.
- `WHATSAPP_STUDY_ENABLED` — must remain unset or `false` until the migration is applied and the official Meta webhook/send flow has been tested; set to the exact string `true` only for controlled activation.

The database migration `drizzle/migrations/0077_whatsapp_study_integration.sql` must be reviewed and applied to the connected Supabase database before enabling the webhook.

## Meta configuration

1. Configure a WhatsApp Business Platform app and add the inbound message webhook subscription.
2. Set the callback URL to the deployed origin plus `/api/public/whatsapp/webhook`.
3. Set the same high-entropy verify token in Meta and `WHATSAPP_VERIFY_TOKEN`.
4. Add the `messages` webhook field and use the Meta app secret for signature verification.
5. Complete Meta's test-number flow, then verify a real inbound webhook and outbound reply.

## In-app linking UI

The authenticated profile settings include a WhatsApp section. It displays connection status and, when the database migration and all server-side Meta settings are ready, generates a one-time code. Students send `CONECTAR <code>` to the configured business number. The code expires after 10 minutes; the UI does not claim that WhatsApp study practice is active.

## AI Teacher handoff and activation boundary

For a linked sender, ordinary text messages are routed through `teacherTurnFromWhatsApp`, a server-only adapter that calls the same `runTeacherTurn` pipeline used by the app. This reuses the AI Gateway quota/telemetry, server-owned CEFR context, existing conversation storage, mistake recording and evidence decision/persistence rules; it does not create a second teacher or evidence engine. Provider message IDs are claimed before processing to prevent Meta redeliveries from repeating a turn.

The route intentionally remains in acknowledgement-only mode unless `WHATSAPP_STUDY_ENABLED=true`. Keep this flag disabled until migration `0077` is applied to the connected Supabase project, all six official Meta settings are configured as server secrets, the Meta webhook subscription is completed, and real inbound/outbound tests pass. CI tests alone do not activate the integration or prove Meta connectivity. Do not advertise the integration as live before these checks.
