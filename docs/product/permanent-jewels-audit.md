# Permanent Jewels — Audit and Implementation Plan

Date: 2026-10-29
Scope: audit only. No runtime behavior, schema, or student data changed.

## Goal

Separate three concepts without disturbing existing product behavior:
1. Permanent learning jewels: earned from validated learning evidence and observable progress.
2. Weekly League: weekly competition based on the existing weekly XP/ranking rules.
3. Study Streak: practice regularity only; streak loss must never revoke a permanent jewel.

Preserve the ten existing visual tiers: Bronze, Silver, Gold, Sapphire, Ruby, Emerald, Amethyst, Pearl, Obsidian, Diamond.

## Findings verified in the repository

### 1. Existing tier component is streak-derived

File: `src/components/LeagueBadge.tsx`

- `getLeague(streakDays)` maps the supplied streak into one of ten tiers.
- `DAYS_PER_LEAGUE = 7`; the tier index is `floor(streakDays / 7)`, capped at Diamond.
- `getNextLeague(streakDays)` and progress display are also derived from streak days.
- The component is presentation plus deterministic calculation; this file does not persist a grant.

Conclusion: this component currently represents a streak milestone, not a permanent achievement. Do not simply change its input to a score or silently reuse it for permanent jewels; first separate the concepts and usages.

### 2. Weekly competition is separate and server-calculated

Files:
- `src/components/WeeklyLeagueSummary.tsx`
- `src/lib/competitiveLeagueRules.ts`
- `drizzle/migrations/0039_weekly_league.sql`
- `drizzle/migrations/0044_league_by_max_level.sql`
- `drizzle/migrations/0075_league_week_xp_study_days.sql`
- `drizzle/migrations/0078_weekly_league_history.sql`

The dashboard uses the `weekly_league()` RPC. Weekly XP is calculated server-side from persisted lessons, activities, vocabulary/error reviews, and credited study days. Existing competitive tiers/rank movement are defined separately in `competitiveLeagueRules.ts`.

Conclusion: keep weekly XP and league placement independent from permanent jewel grants. Do not use streak length to grant or revoke permanent jewels.

### 3. Existing pedagogy evidence is a strong candidate source

Files:
- `src/lib/pedagogy/proofOfProgress.ts`
- `src/lib/pedagogy/proofOfProgress.functions.ts`
- `src/lib/pedagogy/learningState.ts`
- `src/lib/pedagogy/activityEvidence.ts`

The server-side Proof of Progress loader reads existing `assessment_evidence`, completed `assessment_skill_results`, and completed assessment sessions. The pure pedagogy layer already distinguishes transfer, consolidation, observable growth, and new evidence. Learning State uses validated evidence, de-duplicates repeated records, respects source ceilings, and requires multiple sustaining results for a demonstrated stage.

Important constraint: Proof of Progress is currently a read-only interpretation, not an achievement ledger. It explicitly does not create scores, metrics, evidence, or persistent history. Reuse it as evidence input where appropriate, but do not treat a display highlight alone as a durable grant.

### 4. No dedicated jewel/achievement persistence surfaced in the inspected source paths

The inspected tree and repository code search surfaced the streak-derived `LeagueBadge`, weekly league logic, and Proof of Progress, but no dedicated permanent-jewel/achievement ledger or grant function was found in those searches.

This is a bounded finding, not proof of absence across all deployed database objects or connected infrastructure. Before schema changes, inspect the deployed Supabase schema, migrations, RPCs, triggers, RLS policies, and existing production data. Never infer absence from a missing table name alone.

## Proposed design (not implemented yet)

### Separation of responsibilities

- Study Streak: retains its existing streak calculation and UI behavior.
- Weekly League: retains existing weekly XP, ranking, opt-in, level grouping, and weekly reset behavior.
- Permanent Jewels: new durable achievement concept, earned from server-validated evidence and never recomputed from current streak.

### Evidence principles

- Only completed, valid, deduplicated evidence can qualify; opening an activity is not evidence.
- Respect the existing skill and source reliability/quality semantics. Confidence/reliability is not mastery percentage.
- Require evidence across distinct sessions/days where the achievement claims retention or sustained mastery.
- Compare skill history only at the same CEFR level when measuring growth, following the existing Proof of Progress behavior.
- Do not invent a baseline if comparable historical evidence does not exist.
- Grant logic must be server-side and idempotent; duplicate retries must not create duplicate grants.
- Store a rule version and the qualifying evidence references/reason for auditability.
- A grant is permanent. Changes to streak, weekly rank, or future performance do not delete it.
- Any migration must be additive and preserve existing profiles, history, RLS, and app architecture.

### Proposed tier policy requiring validation before coding

Keep the ten tier names and artwork, but do not assign arbitrary XP thresholds to them. Define a versioned rubric based on verified evidence and progressively stronger learning criteria. A possible progression is:
- Bronze/Silver/Gold: validated early evidence and repeated application.
- Sapphire/Ruby/Emerald: sustained production and improvement at the student's own CEFR level.
- Amethyst/Pearl/Obsidian/Diamond: repeated production, transfer across contexts, and maintenance over time.

These are design groupings only, not final thresholds. Each tier needs an explicit measurable rule, anti-duplication rule, and test cases before implementation.

## Required next audit before database changes

1. Read the deployed Supabase schema and all relevant RLS policies, triggers, and functions for `assessment_evidence`, `assessment_skill_results`, `assessment_sessions`, profiles, and any achievement-like objects.
2. Confirm which evidence types reliably persist in production and whether source IDs can be used as stable references.
3. Trace all usages of `LeagueBadge` / `getLeague` and determine the existing student-facing streak milestone behavior so it can be preserved or relabeled without breaking UX.
4. Check historical data impact and whether users already earned streak-based tiers that should be retained as a separate legacy milestone.
5. Finalize measurable thresholds and grant semantics with unit tests before writing migrations or UI changes.

## Acceptance criteria for the eventual implementation

- Permanent jewel grant is stored server-side and remains after streak resets.
- Weekly League and Study Streak rules/results remain unchanged.
- Replaying the same qualifying evidence never creates duplicate grants.
- No grant from opening an activity, invalid evidence, or unverified client-supplied scores.
- Tests cover tier boundaries, missing baselines, same-day duplicates, repeated sessions, CEFR-level separation, transfers, maintenance intervals, and permanent retention.
- RLS and server authorization are tested; no student's private evidence is exposed to other students.
- Existing ten tier assets/names and unrelated dashboard layout are preserved unless separately approved.
- CI/test evidence is recorded before declaring completion.
