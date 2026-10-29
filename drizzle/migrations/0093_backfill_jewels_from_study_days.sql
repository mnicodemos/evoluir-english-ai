-- Backfill permanent jewels from the longest consecutive run of credited study days.
-- Migration 0092 used the current profile streak; this follow-up also restores
-- milestones proven by the immutable study_days history after a streak reset.
-- It is idempotent and does not change study-day eligibility or streak rules.

WITH numbered_days AS (
  SELECT
    user_id,
    day,
    day - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day)::int AS streak_group
  FROM public.study_days
),
streak_runs AS (
  SELECT user_id, streak_group, COUNT(*)::int AS streak_length
  FROM numbered_days
  GROUP BY user_id, streak_group
),
historical_streaks AS (
  SELECT user_id, MAX(streak_length)::int AS longest_streak
  FROM streak_runs
  GROUP BY user_id
),
best_evidence AS (
  SELECT
    p.id AS user_id,
    GREATEST(COALESCE(h.longest_streak, 0), COALESCE(p.streak_days, 0)) AS best_streak
  FROM public.profiles AS p
  LEFT JOIN historical_streaks AS h ON h.user_id = p.id
)
INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
SELECT evidence.user_id, milestone.jewel_index, milestone.jewel_code
FROM best_evidence AS evidence
CROSS JOIN (VALUES
  (0, 'bronze', 1),
  (1, 'silver', 7),
  (2, 'gold', 14),
  (3, 'sapphire', 21),
  (4, 'ruby', 28),
  (5, 'emerald', 35),
  (6, 'amethyst', 42),
  (7, 'pearl', 49),
  (8, 'obsidian', 56),
  (9, 'diamond', 63)
) AS milestone(jewel_index, jewel_code, required_streak_days)
WHERE evidence.best_streak >= milestone.required_streak_days
ON CONFLICT (user_id, jewel_index) DO NOTHING;

NOTIFY pgrst, 'reload schema';
