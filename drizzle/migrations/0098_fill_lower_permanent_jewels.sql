-- Every jewel below a student's highest permanent jewel counts as earned
-- (owner report, 2026-10-31: a student had only Amethyst stored, so Bronze to
-- Emerald showed as not earned). Reaching a jewel means passing every one
-- before it. Idempotent: existing awards are kept, missing lower ones added.

INSERT INTO public.permanent_jewel_awards (user_id, jewel_index, jewel_code)
SELECT highest.user_id, milestone.jewel_index, milestone.jewel_code
FROM (
  SELECT user_id, MAX(jewel_index) AS top_index
  FROM public.permanent_jewel_awards
  GROUP BY user_id
) AS highest
JOIN (VALUES
  (0, 'bronze'),
  (1, 'silver'),
  (2, 'gold'),
  (3, 'sapphire'),
  (4, 'ruby'),
  (5, 'emerald'),
  (6, 'amethyst'),
  (7, 'pearl'),
  (8, 'obsidian'),
  (9, 'diamond')
) AS milestone(jewel_index, jewel_code)
  ON milestone.jewel_index < highest.top_index
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
