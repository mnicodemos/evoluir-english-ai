# AI Limits Audit — Phase 8

Audit only. No limit value, commercial rule, gateway, pedagogy or Stripe code was changed.

## 1. Current architecture

```
Stripe -> webhook -> subscriptions -> entitlements
        -> has_active_entitlement() -> Premium/Free
        -> reserve_ai_usage() -> daily/monthly/concurrency/rate quota
        -> ai_usage_events (reserve, finish, deny)
```

- `src/lib/ai-usage.server.ts` — reads the `ai_limits` row for the operation and passes the
  values to the database function. It does not decide Free vs Premium.
- `public.reserve_ai_usage` (SECURITY DEFINER) — sole decision point. Takes
  `pg_advisory_xact_lock(user + operation)`, resolves Premium through
  `has_active_entitlement()` for `ai_teacher | ai_talking | writing_correction | advanced_reports`,
  then checks daily -> monthly -> concurrency -> min interval, in that order.
- `src/lib/ai-gateway.server.ts` — reserve before the model call, `finishAiUsage` on success and
  on failure; optional response cache keyed by the request hash (cache hit does not consume quota).

## 2. Source of authority

Valid entitlement in the database. `profiles.plan` is display/history only (Phase 6C) and is not
read by the quota path. The browser sends no plan, price, counter or limit; every AI entry point
resolves `userId` server-side (`requireSupabaseAuth` for server functions,
`authenticateApiRequest` for `/api/speech`, `/api/transcribe`, `/api/coach-stream`).

## 3. Current limits (table `ai_limits`, live values)

| Operation | Free daily | Free monthly | Premium daily | Premium monthly | Max concurrent | Min interval (s) | Cache TTL (s) |
|---|---|---|---|---|---|---|---|
| chat | 60 | 1000 | 300 | 6000 | 2 | 1 | 0 |
| teacher | 60 | 1000 | 300 | 6000 | 1 | 1 | 0 |
| talking | 80 | 1500 | 400 | 8000 | 2 | 1 | 0 |
| transcription | 60 | 1000 | 300 | 6000 | 1 | 2 | 0 |
| tts | 100 | 1800 | 500 | 9000 | 2 | 1 | 0 |
| writing_correction | 10 | 200 | 50 | 1000 | 1 | 3 | 0 |
| dictionary | 30 | 500 | 150 | 3000 | 2 | 1 | 86400 |
| lesson_generation | 10 | 120 | 30 | 500 | 1 | 10 | 0 |
| quiz_generation | 5 | 40 | 20 | 200 | 1 | 10 | 0 |
| vocabulary_generation | 10 | 180 | 40 | 800 | 1 | 5 | 0 |

The 60/1000 and 300/6000 reference values apply to `chat`, `teacher` and `transcription`; the other
operations have their own values. Confirmed live, not from constants.

## 4. AI consumption points

| Feature | File | Operation | Reserve | Finish | Notes |
|---|---|---|---|---|---|
| AI Teacher | `src/lib/aiTeacher.functions.ts` | teacher | gateway | gateway | concurrency 1 |
| AI Talking / Coach | `src/lib/coach.functions.ts`, `src/routes/api/coach-stream.ts` | talking | gateway / route | yes | streaming route authenticates first |
| Writing correction | `src/lib/coach.functions.ts` | writing_correction | gateway | gateway | |
| Listening / audio | `src/routes/api/speech.ts` | tts | route | route | |
| Speaking / pronunciation | `src/routes/api/transcribe.ts` | transcription | route | route | |
| Dictionary | `src/lib/dictionary.functions.ts` | dictionary | gateway | gateway | 24h cache |
| Lessons / quizzes | `src/lib/curriculum.functions.ts` | lesson_generation, quiz_generation | gateway | gateway | |
| Vocabulary plan | `src/lib/vocabularyPlan.functions.ts` | vocabulary_generation | gateway | gateway | |
| Legacy activity | `src/lib/legacyActivity.functions.ts` | talking | gateway | gateway | |

Double counting: not observed. One reservation per gateway call; denied events are excluded from the
counters (`status IN ('pending','completed')` only); a cache hit returns before reserving.

## 5. Quota behaviour

- Precedence: daily, then monthly, then concurrency, then minimum interval.
- Reset: calendar day and calendar month in `America/Sao_Paulo`.
- Concurrency: counts `pending` events from the last 10 minutes.
- Race conditions: serialised per user+operation by an advisory transaction lock.
- Cancellation/expiry/revocation/multiple subscriptions: resolved by `has_active_entitlement()`,
  validated in Phase 6C.

## 6. Security result

No manipulation path found. Plan, entitlement, counter and quota all live server-side; the browser
cannot send them. Requests without a valid session are rejected before any reservation. Replayed or
concurrent requests are limited by the interval and concurrency checks.

## 7. Observed usage (real data)

104 events, 1 user (the workspace owner), 17–18 Sep 2026: transcription 41, teacher 16+2 denied,
talking 15, tts 14+6 errors, writing_correction 4, vocabulary_generation 2+1 denied,
lesson_generation 2. Premium users: 1. Free users: 0.

**Insufficient data to conclude real consumption behaviour.** There is a single test account, so no
average, median, concentration or share of users hitting quota can be derived.

## 8. Observed cost

`input_tokens`, `output_tokens` and `estimated_cost` are null in 104/104 events: the Gemini call does
not return usage metadata to `finishAiUsage`. **No cost data available.** No provider price is
estimated here.

## 9. Risk matrix

| Item | Current state | Risk | Severity | Action |
|---|---|---|---|---|
| Premium authority | Valid entitlement in DB | None found | — | Keep |
| Daily quota | Per operation, calendar day (São Paulo) | None found | — | Keep |
| Monthly quota | Per operation, calendar month | None found | — | Keep |
| Reset | Calendar based, fixed timezone | None found | — | Keep |
| Concurrency | Pending events in a 10-min window | Stale pending event keeps consuming one slot for 10 min (1 observed) | Low | Document |
| Retry / rate limit | Minimum interval per operation | None found | — | Keep |
| Idempotency | Request hash + one reservation per call | None found | — | Keep |
| Cost | Tokens and cost never recorded | Cannot measure cost per user or per plan | Medium | Future phase |
| UX | Distinct messages for daily, monthly, concurrency, rate limit | None found | — | Keep |
| Free/Premium differentiation | 5x daily and 6x monthly, no exclusive feature gated | Premium differs by volume only | Medium (commercial) | Future decision |

## 10. Conclusion

The quota system is technically consistent and server-authoritative. No critical or high issue was
found, therefore no limit value or rule was changed.

## 11. Future recommendation

1. Record token usage and cost per call so limits can be calibrated against real spend.
2. Re-run this audit once there are real Free and Premium users; only then decide values.
3. Consider expiring stale `pending` events so a dropped request frees its concurrency slot sooner.
4. Commercial decision (out of scope here): Premium currently differs from Free by volume only.
