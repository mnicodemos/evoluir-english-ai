-- Music Lab keeps no song history (audit, 2026-10-29): songs exist only in the
-- student's session, so the table created by 0086 was never read or written.
-- Idempotent: safe to apply again. The private music-lab-audio bucket from 0086
-- is empty and stays (Supabase does not allow deleting a bucket through SQL;
-- remove it in the Storage panel if wanted).
DROP TABLE IF EXISTS public.music_lab_songs;

NOTIFY pgrst, 'reload schema';
