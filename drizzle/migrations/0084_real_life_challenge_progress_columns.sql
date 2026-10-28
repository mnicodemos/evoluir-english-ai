ALTER TABLE public.real_life_challenge_progress ADD COLUMN IF NOT EXISTS selected_option_id text CHECK (char_length(selected_option_id) <= 32);
ALTER TABLE public.real_life_challenge_progress ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.real_life_challenge_progress ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
NOTIFY pgrst, 'reload schema';