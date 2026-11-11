# Weekly Frequency — Model A

Status: Model A implementation merged; this document records the approved rule and validation contract. No production data or schema changes are part of the test-only follow-up.

## Approved product rule

For a weekly target of D days and C distinct qualified study dates in the Monday–Sunday study week:

- Weekly credit = min(C, D).
- Progress = min(C, D) / D.
- The weekly goal is reached when C >= D.
- Every qualified date remains in the existing study-day history. Dates above the target are not deleted, rewritten, or converted into extra weekly credit.

A qualified day continues to use the existing `study_days` source (with the existing `qualifiesAsStudyDay` fallback). This change does not redefine what qualifies as a study day.

## UI contract

- Weekly Frequency uses the Model A capped count.
- Weekday tiles outside the selected study plan remain visually disabled and are not relabeled as planned days.
- An off-plan qualified study day can contribute to the weekly target without changing the student's saved weekday selection.
- Frequency Calendar continues to show all qualified study dates; planned weekdays remain an independent outline.
- My Study Plan continues to mark a scheduled skill slot complete only when its existing skill-specific practice matcher is satisfied. That is a different measure from weekly frequency and must not be silently conflated with it.

## Explicit exclusions

No changes to streak calculation, weekly freeze, permanent jewel awards, Diamond cycles, XP, weekly league, migrations, historical rows, or production data. No 20% bonus, 50% extra-day weight, or 5%/10% multiplier is introduced.

## Validation

Pure-function tests cover weekly targets of 1, 2, 3, 5 and 7 days; partial progress; off-plan qualified dates; excess dates capped without losing the full valid-day count; deduplication by calendar date; and zero/negative targets. The component derives week boundaries and labels using the America/Sao_Paulo study time zone and a Monday–Sunday week. Repository CI must pass before merge.
