# Monetisation foundation (Phase 6A) — audit + contracts

No gateway is integrated. No checkout, no webhook, no payment data.

## Existing architecture (reused, not recreated)

| Area | Current state | Reuse | Gap |
| --- | --- | --- | --- |
| Auth | Supabase auth, `_authenticated` layout gate, bearer middleware | Yes | — |
| Profiles | `public.profiles` (1:1 with auth user), RLS `auth.uid() = id` | Yes | — |
| Plan fields | `profiles.plan`, `plan_interval`, `plan_started_at`, `plan_expires_at`; trigger `protect_profile_plan_fields` reverts any non-service_role change | Yes | Plan is a flat field, not a subscription lifecycle |
| Premium UI | `/premium` route (informational pricing: R$ 79,90/mês, R$ 799,90/ano), Crown badge in dashboard/sidebar | Yes | Checkout not wired (intentional) |
| Subscription | did not exist | — | created: `public.subscriptions` |
| Entitlement | did not exist | — | created: `public.entitlements` + `has_active_entitlement()` |
| AI limits | `ai_limits` (free + premium daily/monthly, interval, concurrency, cache TTL), `ai_usage_events`, `reserve_ai_usage()` reads `profiles.plan` + `plan_expires_at` | Yes — untouched | Entitlement is not yet the input to `reserve_ai_usage` |
| Feature gating | No hard gate exists. Free vs Premium differ **only** by AI quotas | Yes | Commercial Free/Premium feature split is undefined — recorded as a gap, not invented |
| RLS | Enabled on all user tables; pedagogical/legacy writes only via privileged RPCs | Yes | — |
| Webhook | did not exist | — | contract documented below only |

## Model

```
USER -> SUBSCRIPTION -> ENTITLEMENT -> FEATURE
```

- `subscriptions`: provider-agnostic (`provider`, `provider_customer_id`, `provider_subscription_id`), statuses `active | trial | canceled | expired | payment_failed | refunded`, period columns, `canceled_at`.
- `entitlements`: one row per (user, feature) with `plan`, `source_subscription_id`, `granted_at`, `expires_at`, `revoked_at`.
- `has_active_entitlement(user_id, feature)`: SECURITY DEFINER, STABLE — the server-side answer to "can this user use this feature?".
- A successful payment never equals access: access requires an access-granting status **and** a valid period/entitlement.

## Security

- `subscriptions` and `entitlements`: `GRANT SELECT` to `authenticated` only, `ALL` to `service_role`. RLS allows SELECT of own rows only — no INSERT/UPDATE/DELETE policy exists, so the client cannot create or modify a subscription or entitlement.
- No card number, CVV, or any payment instrument data is stored; only opaque provider IDs.
- The frontend may never assert `isPremium`, `plan`, or `status`; authority is the database.

## Future webhook contract (not implemented)

```
Gateway -> /api/public/webhooks/<provider> -> signature validation
        -> idempotent event record -> subscription upsert
        -> entitlement grant/revoke -> feature access
```

Required behaviour when implemented: verify the provider signature before any read of the body payload; store a provider event id for idempotency so duplicates are no-ops; handle status change, renewal, cancellation, payment failure, refund, upgrade and downgrade; never trust client input.

## AI entitlement path (future, no change yet)

`reserve_ai_usage()` currently derives premium from `profiles.plan`. The future integration replaces only that predicate with `has_active_entitlement(user_id, '<feature>')`, keeping `ai_limits`, quotas, caching, reservation and audit exactly as they are.

## Untouched by design

AI Teacher (`teacherTurn`, `loadTeacherSession`, teacher context/prompt/evidence, `AiTeacherChat`, `/teacher`) and the whole pedagogical layer (`assessment_*`, CEFR, confidence, dual-write, idempotency) were not modified. Payments and pedagogy stay decoupled.
