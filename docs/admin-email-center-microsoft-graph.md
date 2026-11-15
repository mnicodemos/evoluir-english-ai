# Admin email center — Microsoft Graph integration

## Scope

Track the Evoluir+ Admin email center for:
- contato@evoluirmaisenglishai.com
- suporte@evoluirmaisenglishai.com

## Confirmed provider architecture
- ImprovMX remains the inbound forwarding provider.
- The existing Hotmail account remains the mailbox of record for inbound messages.
- Microsoft Graph is used to read and synchronize messages from that personal Microsoft account.
- Resend remains the outbound provider. Replies must use the corresponding verified Evoluir+ domain sender.
- Do not enable Resend inbound receiving or change DNS/MX records as part of this work.

## Microsoft app registration
- Display name: Evoluir+ Admin Email
- Application (client) ID: 16fe0bc6-0064-48bb-9702-9d656deec9e
- Supported account type: personal Microsoft accounts only
- Delegated permissions configured: Mail.Read, User.Read, offline_access
- No client secret has been created. Never add credentials to the browser bundle or commit secrets.

## Implementation requirements
1. Reuse the existing admin authorization and communication UI.
2. Add OAuth authorization-code flow with PKCE and an exact redirect URI registered in Entra.
3. Use least-privilege delegated Graph permissions.
4. Keep tokens server-side, encrypted at rest, with strict admin-only access. Never persist tokens in localStorage or expose them to client components.
5. Synchronize messages idempotently using Graph message IDs and preserve conversation identifiers.
6. Classify messages into Contato or Suporte using forwarded recipient/header metadata; do not guess when the original recipient cannot be established.
7. Send replies through the existing Resend server integration, with an explicit allowlist for the two verified senders.
8. Preserve Hotmail as the source of truth. Do not delete or move messages during initial synchronization.
9. Test OAuth state/PKCE validation, token secrecy, admin authorization, deduplication, mailbox classification, and sender allowlisting.
10. Keep the feature disabled server-side until credentials, redirect URI, and end-to-end tests are ready.

## Outstanding configuration
- Confirm the exact callback URL after implementing the route, then register it in Entra as a Web redirect URI.
- Store OAuth configuration in deployment secrets/configuration. The client ID is not secret.
- Confirm sender identities for both addresses in Resend.
- Never request or store the Hotmail password.
- Do not require a paid Azure subscription solely for app registration.

## Current status
Preparation only. This document does not claim OAuth, Graph synchronization, database persistence, or the admin inbox UI have been implemented. Those require code changes and end-to-end validation before production enablement.