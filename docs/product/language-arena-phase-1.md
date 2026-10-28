# Language Arena — Phase 1 implementation contract

## Goal
Evolve the existing Weekly League into the first reliable layer of Language Arena without replacing the current XP engine, opt-in privacy model, CEFR learning paths, permanent jewels, or eight-week personal history.

## Current-state facts verified in the repository
- The authenticated route is `src/routes/_authenticated/league.tsx`.
- Weekly XP is calculated in PostgreSQL by `public.league_week_xp(user_id, week_start)`; the UI's XP guide mirrors that rule.
- `public.weekly_league()` groups participants by `coalesce(profiles.max_level, profiles.level)`, returns the top 20 plus the caller's own row, and exposes other participants as first name + initial only when they opted in.
- Weekly history is provided by `weekly_league_history` and shows the last eight weeks.
- Week boundaries use `America/Sao_Paulo`, Monday through Sunday.
- The current RPC uses `rank()` by XP, so equal XP can share a rank and leave gaps. The response does not provide a complete participant list or a trusted total cohort size. The UI must not infer promotion/demotion zones from the visible rows alone.
- Existing notes say jewels are permanent progression and must not be confused with weekly league XP.

## Phase 1 scope
1. Add a dedicated, backward-compatible database contract for competitive status; do not change the signature of `weekly_league()` or the XP formula.
2. Compute the complete cohort size and the signed-in participant's rank/zone server-side, from the same eligible opt-in cohort and week boundaries as the existing ranking.
3. Use an explicit deterministic tie-break rule. Product/engineering must verify an appropriate stable secondary field before implementing it; do not use display names or expose private identifiers as a tie-break.
4. Show accessible, clearly labelled Promotion / Staying / Demotion zones and the user's own position relative to the promotion cutoff. Do not use colour alone.
5. Keep the existing ranking, opt-in flow, privacy masking, XP guide, and eight-week history working.
6. Add tests for cohort sizes 1, 2, 19, 20, 21; tied XP; opted-out users; users outside the visible top 20; week rollover in America/Sao_Paulo; and empty/single-member cohorts.

## Proposed initial policy (must be encoded only after validation)
- Ten named divisions: Bronze, Silver, Gold, Sapphire, Ruby, Emerald, Amethyst, Pearl, Obsidian, Diamond.
- For an eligible cohort of 20, target promotion for the top 4 and demotion for the bottom 3; Bronze has no demotion and Diamond has no higher division. These are proposed product rules, not currently implemented rules.
- If cohorts are smaller than 10, do not force a promotion/demotion outcome that would make the competition misleading; define and test a minimum-cohort policy before release.
- Keep the user's highest division achieved permanently. Never reset permanent jewels or peak division during weekly rollover.

## Explicit non-goals for this phase
- No XP formula changes or XP farming multipliers.
- No changes to CEFR progression, Final Test promotion rules, study-day/streak logic, jewels, or Premium entitlements.
- No team missions, AI rival, or skill-evidence scoring until competitive status is correct and observable.
- No schema/table redesign unless the audit proves it is required.

## Acceptance criteria
- The UI does not derive competitive zones from only the top 20 rows.
- The same user/week/cohort produces the same rank and zone on repeated calls.
- Equal XP is handled by a documented, deterministic tie-break.
- Opt-out users are excluded from the public cohort and cannot see other participants' private information.
- Existing Weekly League, XP totals, history, mobile layout, and opt-in/out behaviour remain intact.
- Migration, RPC permissions, type generation, unit/integration tests, and CI results are attached to the implementation PR before merge.
- Changes remain behind a PR and are not merged or deployed without explicit approval.
