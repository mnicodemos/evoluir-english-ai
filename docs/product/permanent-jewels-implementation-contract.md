# Permanent Jewels — Implementation Contract

Status: proposal for review; no runtime or database behavior changed.
Related audit: `docs/product/permanent-jewels-audit.md`.

## Scope of this PR

This document defines the safe implementation boundary for permanent learning jewels. It does not grant jewels, change the existing streak badge, change weekly competition, or apply a production migration.

## Product invariants

1. A permanent jewel is a durable achievement record, not a current score or streak snapshot.
2. Once granted, a jewel is never deleted or downgraded because of streak loss, weekly league movement, later assessment results, or a CEFR profile change.
3. Weekly League remains governed by its existing server-side XP/ranking rules.
4. Study Streak remains a regularity measure and must not be used as a permanent-jewel grant or revocation condition.
5. Preserve the existing ten tier names/assets: Bronze, Silver, Gold, Sapphire, Ruby, Emerald, Amethyst, Pearl, Obsidian, Diamond. Do not repurpose the current streak-derived `LeagueBadge` silently.
6. Confidence/reliability is measurement reliability, not a mastery percentage. It must not be presented or used as mastery by itself.

## Evidence contract

A grant rule must identify, before implementation:
- the learning outcome being recognized;
- eligible evidence sources and accepted session statuses;
- minimum evidence quality/reliability and source-specific ceilings, reusing existing pedagogy rules;
- whether evidence must span distinct sessions or dates;
- how duplicates/retries are identified;
- how CEFR level is scoped;
- how missing baseline/history is handled;
- the exact rule version and reason recorded with the grant.

Only completed, valid, server-validated and de-duplicated evidence may qualify. Opening a lesson/activity or accumulating streak days alone is not proof of learning. Do not fabricate a baseline where comparable history does not exist. Compare progress at the same CEFR level when the rule claims growth.

## Proposed persistence contract

The implementation should add an append-only grant ledger through an additive migration. Final table/column names are subject to repository conventions and migration review.

Each grant should record at least:
- stable grant ID;
- user ID;
- stable achievement key (not just a translated display name);
- tier/key and rule version;
- grant timestamp;
- qualifying evidence references and a concise reason/metadata;
- a deterministic idempotency key or equivalent unique constraint.

A unique constraint must prevent a retry from granting the same achievement to the same user twice. The grant path must be server-side and authenticated/authorized; client input must never be trusted as proof. RLS must allow a learner to read only their own grants, while writes are restricted to the trusted server path. Do not expose service-role credentials to clients.

The ledger should not cascade-delete grants when source evidence is updated or removed. Where foreign keys to evidence could violate permanence, store immutable source identifiers/references and the relevant rule snapshot rather than a cascading dependency. Follow existing project migration conventions and review actual retention requirements before finalizing.

## Rule design gate

The ten visual tiers are known, but the actual qualification criteria and thresholds have not yet been validated. Do not implement arbitrary percentages, point counts, or automatic tier mapping until the product criteria are approved. A tier label alone is not a grant rule.

Before automatic grants are enabled, create a versioned rule matrix containing:
- achievement key and tier;
- qualifying learning outcome;
- accepted evidence and quality constraints;
- repeat/retention/transfer requirements;
- CEFR scope;
- deterministic examples that qualify and do not qualify.

## Required tests

- duplicate request/retry grants at most once;
- duplicate evidence does not inflate evidence counts;
- incomplete, abandoned, invalidated, or insufficient-evidence sessions do not qualify;
- distinct-session requirements are enforced;
- no baseline means no fabricated growth claim;
- comparisons across different CEFR levels do not count as same-level growth;
- transfer/consolidation rules use the existing pedagogy semantics;
- confidence is not treated as mastery;
- learner A cannot read or write learner B's grants;
- clients cannot self-award grants;
- losing streak or weekly-rank movement does not remove or downgrade a grant;
- existing weekly league and streak tests/behavior remain unchanged.

## Rollout sequence

1. Approve the rule matrix.
2. Implement the additive ledger migration and server-only grant function.
3. Add unit, integration, idempotency, and RLS tests.
4. Run repository typecheck and relevant test suites; record actual results in the PR.
5. Review the diff and migration plan before merge.
6. Enable grants only after test evidence and explicit product review.

## Explicit non-goals

- No changes to `weekly_league()`, XP, league ranking, streak calculation, or existing streak UI.
- No retroactive awards without a separate audited backfill plan.
- No production migration, grant backfill, or student-data mutation as part of this specification.
