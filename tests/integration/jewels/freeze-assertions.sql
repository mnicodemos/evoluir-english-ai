\set ON_ERROR_STOP on
INSERT INTO public.profiles (id,streak_days) VALUES
('00000000-0000-0000-0000-000000000009',4),
('00000000-0000-0000-0000-000000000010',4),
('00000000-0000-0000-0000-000000000011',62);
DO $$
DECLARE d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 UPDATE public.profiles SET last_activity_date=d-2, streak_freeze_used_on=NULL WHERE id='00000000-0000-0000-0000-000000000009';
 INSERT INTO public.activities(user_id,activity_type,created_at) SELECT '00000000-0000-0000-0000-000000000009','writing',now() FROM generate_series(1,3);
 PERFORM public.credit_study_day('00000000-0000-0000-0000-000000000009');
 IF (SELECT streak_days FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000009')<>5 THEN RAISE EXCEPTION 'Freeze did not preserve streak'; END IF;
 IF (SELECT streak_freeze_used_on FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000009')<>d-1 THEN RAISE EXCEPTION 'Freeze date not recorded'; END IF;
 IF EXISTS (SELECT 1 FROM public.study_days WHERE user_id='00000000-0000-0000-0000-000000000009') THEN RAISE EXCEPTION 'Freeze created artificial study_days'; END IF;
END $$;
DO $$
DECLARE d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
        used date := date_trunc('week', ((now() AT TIME ZONE 'America/Sao_Paulo')::date-1)::timestamp)::date;
BEGIN
 UPDATE public.profiles SET last_activity_date=d-2, streak_freeze_used_on=used WHERE id='00000000-0000-0000-0000-000000000010';
 INSERT INTO public.activities(user_id,activity_type,created_at) SELECT '00000000-0000-0000-0000-000000000010','writing',now() FROM generate_series(1,3);
 PERFORM public.credit_study_day('00000000-0000-0000-0000-000000000010');
 IF (SELECT streak_days FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000010')<>1 THEN RAISE EXCEPTION 'Second Freeze in same week incorrectly preserved streak'; END IF;
 IF (SELECT streak_freeze_used_on FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000010')<>used THEN RAISE EXCEPTION 'Prior Freeze usage was overwritten'; END IF;
END $$;
BEGIN;
 UPDATE public.profiles SET streak_days=63 WHERE id='00000000-0000-0000-0000-000000000011';
ROLLBACK;
DO $$ BEGIN
 IF (SELECT streak_days FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000011')<>62 THEN RAISE EXCEPTION 'Streak update survived rollback'; END IF;
 IF EXISTS (SELECT 1 FROM public.permanent_jewel_awards WHERE user_id='00000000-0000-0000-0000-000000000011') THEN RAISE EXCEPTION 'Jewel award survived rollback'; END IF;
END $$;
SELECT 'PASS: Freeze, no artificial study day, one-freeze-per-week and rollback' AS result;
