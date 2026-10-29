# Permanent Jewels — Versioned Rule Matrix (Draft)

Status: product-review draft only. No grant logic, runtime behavior, database schema, or student data changed.

Related documents:
- `docs/product/permanent-jewels-audit.md`
- `docs/product/permanent-jewels-implementation-contract.md`

## Purpose and approval boundary

This matrix turns the existing ten visual tiers into reviewable achievement definitions before implementation. It is **not approved for automatic grants**. No numeric thresholds are invented here: evidence counts, quality cutoffs, retention intervals, and any per-skill minimums must be confirmed against the current pedagogy engine and product intent before coding.

Every rule is evaluated only from completed, valid, server-validated, de-duplicated evidence. A lesson opened, time spent, streak day, XP, weekly rank, or a single confidence/reliability value cannot independently qualify a permanent jewel.

## Shared evidence rules (apply to all tiers)

1. **Evidence source:** use persisted assessment/evidence sources and their existing validation semantics. Candidate sources include `assessment_evidence`, completed `assessment_skill_results`, and completed assessment sessions; confirm deployed persistence and stable identifiers before implementation.
2. **Quality:** reuse the existing source ceilings and quality/reliability rules. Reliability is not mastery.
3. **Deduplication:** retries or repeated records for the same underlying evidence count once. The final implementation must identify the stable deduplication key.
4. **Session validity:** incomplete, abandoned, invalidated, or client-only/unverified results do not qualify.
5. **CEFR scope:** growth claims compare evidence at the same CEFR level. A profile-level change is not itself evidence of growth. If comparable baseline evidence is missing, do not claim growth.
6. **Skill scope:** record which skill/outcome the rule recognizes. Do not infer speaking, writing, listening, reading, grammar, or vocabulary mastery from unrelated evidence.
7. **Grant permanence:** once granted, keep the grant regardless of later performance, streak loss, weekly league movement, or profile-level changes.
8. **Auditability:** each grant records a stable achievement key, rule version, qualifying evidence references, timestamp, and concise reason. Grant requests must be idempotent and server-authorized.

## Tier matrix — proposal for product review

The progression below is intentionally qualitative. The tier names and artwork remain unchanged. A higher tier must require stronger evidence than the previous tier; it must not be awarded merely because a user accumulated time, XP, or a streak.

| Tier | Proposed learning outcome | Minimum evidence shape to validate | Explicit non-qualifiers |
|---|---|---|---|
| Bronze | First verified learning outcome | At least one valid, completed evidence item for a named skill/outcome, meeting that source's quality ceiling | Opening a lesson; activity started but not completed; streak/XP alone |
| Silver | Early outcome reproduced | Valid evidence showing the same outcome again in a distinct qualifying attempt/session; exact separation rule pending approval | Duplicate retry of the same evidence; one result copied into multiple records |
| Gold | Outcome applied beyond the first attempt | Valid repeated application under a defined task/context variation; variation criteria pending approval | Repeating an identical item without new evidence; time spent alone |
| Sapphire | Sustained skill performance | Multiple valid completed results across distinct sessions, with quality/source limits respected | A single high score; confidence/reliability presented as mastery |
| Ruby | Observable progress at the learner's level | Comparable baseline and later evidence at the same CEFR level demonstrating the defined outcome improved under existing pedagogy semantics | No baseline; comparing different CEFR levels; profile-level change alone |
| Emerald | Progress sustained over time | Observable progress plus later qualifying evidence that sustains the outcome; minimum interval and count pending approval | One-day cluster of duplicates; improvement inferred from streak length |
| Amethyst | Transfer to a new context | Valid evidence that demonstrates the same target skill/outcome in a distinct context, as defined by existing transfer semantics | Repeating the original context only; unsupported transfer inference |
| Pearl | Transfer repeated reliably | Transfer evidence across distinct qualifying sessions/contexts, with de-duplication and quality ceilings applied | Multiple database rows for one attempt; unvalidated generated/client evidence |
| Obsidian | Retention and transfer | Evidence of retained performance after a defined interval plus transfer to a distinct context; interval and scope pending approval | Immediate repetition only; no evidence for retention interval |
| Diamond | Strong, sustained, transferable evidence | The strongest approved combination of repeated valid performance, retention, and transfer across the defined skill scope; all numeric/time gates require explicit approval | XP/streak/weekly rank; one exceptional result; missing history treated as proof |

## Decisions required before this matrix can be approved

For each tier, product and pedagogy review must settle:

- the exact stable achievement key and whether tiers are cumulative, skill-specific, or both;
- the qualifying learning outcome and which skill(s) may satisfy it;
- the accepted evidence sources and status values in deployed Supabase;
- minimum quality/reliability and source ceilings, using existing rules rather than new arbitrary cutoffs;
- distinct-session/date counts and, where applicable, minimum retention intervals;
- what counts as a distinct context for transfer;
- how a learner progresses between tiers and whether a tier is awarded once globally or per skill/CEFR level;
- behavior when historical evidence or a comparable baseline is unavailable;
- concrete positive and negative examples for boundary tests.

Do not implement automatic grants until these decisions are recorded and approved. If product intends one global ten-tier ladder, define how evidence across different skills combines without overstating mastery in any one skill.

## Required validation cases

- Same evidence submitted repeatedly is counted once.
- A retried grant request creates no duplicate grant.
- Incomplete, abandoned, invalidated, or unverified results never qualify.
- Repeated application requires distinct evidence as approved.
- Missing baseline cannot produce a growth grant.
- Growth comparison across CEFR levels is rejected.
- Transfer and retention follow explicit definitions and intervals.
- Confidence/reliability alone never qualifies as mastery.
- One skill's evidence does not silently qualify another skill.
- Grant survives streak loss, weekly rank movement, later results, and CEFR profile changes.
- Learners can read only their own grants; clients cannot award grants.
- Existing Study Streak and Weekly League behavior remains unchanged.

## Safe next step

Approve or revise this matrix first. Then inspect deployed Supabase tables, RLS, triggers, functions/RPCs, stable evidence IDs, and historical data before proposing an additive ledger migration. This PR does not authorize or perform that inspection against production, schema changes, backfills, or automatic awards.
