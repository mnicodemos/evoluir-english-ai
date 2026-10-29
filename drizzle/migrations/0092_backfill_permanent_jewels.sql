-- Restore permanent jewels from the strongest available historical evidence.
-- study_days is the authoritative record of credited valid study days. Calculate
-- each user's longest consecutive run, and also respect a higher persisted
-- streak_days value if it is still present. This does not change eligibility
-- rules or fabricate study-day records.
-- Awards are append-only, and existing awards are preserved.

WITH numbered_days AS (
  SELECT
    user_id,
    day,
    day - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day)::int AS streak_group
  FROM public.study_days
),
historical_streaks AS (
  SELECT user_id, MAX(streak_length)::int AS longest_streak
  FROM (
    SELECT user_id, streak_group, COUNT(*) AS streak_length
    FROM numbered_days
    GROUP BY user_id, streak_group
  ) AS runs
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
