\set ON_ERROR_STOP on

-- Fixed IDs make each scenario isolated and reproducible.
INSERT INTO public.profiles (id, streak_days) VALUES
  ('00000000-0000-0000-0000-000000000001', 0),
  ('00000000-0000-0000-0000-000000000002', 62),
  ('00000000-0000-0000-0000-000000000003', 125),
  ('00000000-0000-0000-0000-000000000004', 125),
  ('00000000-0000-0000-0000-000000000005', 0),
  ('00000000-0000-0000-0000-000000000006', 0),
  ('00000000-0000-0000-0000-000000000007', 0);

-- Cross several thresholds in one trusted upward update.
UPDATE public.profiles SET streak_days = 21
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE codes text[];
BEGIN
  SELECT array_agg(jewel_code ORDER BY jewel_index) INTO codes
  FROM public.permanent_jewel_awards
  WHERE user_id = '00000000-0000-0000-0000-000000000001';
  IF codes IS DISTINCT FROM ARRAY['bronze','silver','gold','sapphire']::text[] THEN
    RAISE EXCEPTION 'JWL-03 expected Bronze..Sapphire, got %', codes;
  END IF;
END $$;

-- Repeating the same value and moving down must not add or remove awards.
UPDATE public.profiles SET streak_days = 21
WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET streak_days = 0
WHERE id = '00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.permanent_jewel_awards
      WHERE user_id = '00000000-0000-0000-0000-000000000001') <> 4 THEN
    RAISE EXCEPTION 'JWL-04/05 awards were duplicated or removed after reset';
  END IF;
END $$;

-- Diamond threshold and repeat-cycle thresholds.
UPDATE public.profiles SET streak_days = 63
WHERE id = '00000000-0000-0000-0000-000000000002';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permanent_jewel_awards
      WHERE user_id = '00000000-0000-0000-0000-000000000002'
        AND jewel_code = 'diamond') THEN
    RAISE EXCEPTION 'JWL-06 Diamond was not granted at day 63';
  END IF;
  IF EXISTS (SELECT 1 FROM public.diamond_cycles
      WHERE user_id = '00000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Diamond cycle 2 was granted before day 126';
  END IF;
END $$;

UPDATE public.profiles SET streak_days = 126
WHERE id = '00000000-0000-0000-0000-000000000003';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.diamond_cycles
      WHERE user_id = '00000000-0000-0000-0000-000000000003' AND cycle = 2) THEN
    RAISE EXCEPTION 'DIA-01 cycle 2 was not granted at day 126';
  END IF;
END $$;

UPDATE public.profiles SET streak_days = 252
WHERE id = '00000000-0000-0000-0000-000000000004';
DO $$
DECLARE cycles integer[];
BEGIN
  SELECT array_agg(cycle ORDER BY cycle) INTO cycles
  FROM public.diamond_cycles
  WHERE user_id = '00000000-0000-0000-0000-000000000004';
  IF cycles IS DISTINCT FROM ARRAY[2,3,4]::integer[] THEN
    RAISE EXCEPTION 'DIA-02 expected cycles 2,3,4, got %', cycles;
  END IF;
END $$;


-- Fase 5: sustained 4-, 8-, and 12-week streak checkpoints.
-- These checkpoints exercise the existing 7-day jewel ladder without
-- changing weekly-frequency credit or inventing study_days rows.
UPDATE public.profiles SET streak_days = 28
WHERE id = '00000000-0000-0000-0000-000000000005';
UPDATE public.profiles SET streak_days = 56
WHERE id = '00000000-0000-0000-0000-000000000006';
UPDATE public.profiles SET streak_days = 84
WHERE id = '00000000-0000-0000-0000-000000000007';

DO $
DECLARE
  four_week_count integer;
  eight_week_count integer;
  twelve_week_count integer;
BEGIN
  SELECT count(*) INTO four_week_count FROM public.permanent_jewel_awards
  WHERE user_id = '00000000-0000-0000-0000-000000000005';
  SELECT count(*) INTO eight_week_count FROM public.permanent_jewel_awards
  WHERE user_id = '00000000-0000-0000-0000-000000000006';
  SELECT count(*) INTO twelve_week_count FROM public.permanent_jewel_awards
  WHERE user_id = '00000000-0000-0000-0000-000000000007';

  IF four_week_count <> 5 THEN
    RAISE EXCEPTION 'F5-04 expected 5 jewels at 4 weeks (28 days), got %', four_week_count;
  END IF;
  IF eight_week_count <> 9 THEN
    RAISE EXCEPTION 'F5-08 expected 9 jewels at 8 weeks (56 days), got %', eight_week_count;
  END IF;
  IF twelve_week_count <> 10 THEN
    RAISE EXCEPTION 'F5-12 expected all 10 jewels at 12 weeks (84 days), got %', twelve_week_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.diamond_cycles
      WHERE user_id IN (
        '00000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000006',
        '00000000-0000-0000-0000-000000000007'
      )) THEN
    RAISE EXCEPTION 'F5-DIA: a Diamond repeat cycle was granted before day 126';
  END IF;
END $;

-- Replays and resets at the long-cycle checkpoints must preserve, not duplicate,
-- the permanent awards already earned.
UPDATE public.profiles SET streak_days = 84
WHERE id = '00000000-0000-0000-0000-000000000007';
UPDATE public.profiles SET streak_days = 0
WHERE id = '00000000-0000-0000-0000-000000000007';
DO $
BEGIN
  IF (SELECT count(*) FROM public.permanent_jewel_awards
      WHERE user_id = '00000000-0000-0000-0000-000000000007') <> 10 THEN
    RAISE EXCEPTION 'F5-PERM: 12-week jewels were removed or duplicated after reset';
  END IF;
END $;

-- A failed transaction must roll back both the streak update and trigger awards.
BEGIN;
UPDATE public.profiles SET streak_days = 7
WHERE id = '00000000-0000-0000-0000-000000000002';
ROLLBACK;
DO $$
BEGIN
  IF (SELECT streak_days FROM public.profiles
      WHERE id = '00000000-0000-0000-0000-000000000002') <> 63 THEN
    RAISE EXCEPTION 'TX-01 streak update survived rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permanent_jewel_awards
      WHERE user_id = '00000000-0000-0000-0000-000000000002'
        AND jewel_code <> 'diamond') THEN
    RAISE EXCEPTION 'TX-01 jewel award survived rollback';
  END IF;
END $$;

SELECT 'PASS: permanent jewel and diamond-cycle PostgreSQL integration assertions' AS result;
