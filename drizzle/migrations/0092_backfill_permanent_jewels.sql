-- Restore permanent jewels for milestones already represented by persisted streak_days.
-- This is a one-time backfill only; it does not change day-credit eligibility or streak rules.
-- Awards are append-only, and existing awards are preserved.
INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
SELECT p.id, milestone.jewel_index, milestone.jewel_code
FROM public.profiles AS p
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
WHERE COALESCE(p.streak_days, 0) >= milestone.required_streak_days
ON CONFLICT (user_id, jewel_index) DO NOTHING;

NOTIFY pgrst, 'reload schema';
