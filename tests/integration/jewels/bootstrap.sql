-- Minimal disposable schema for real Freeze and jewel migrations.
\\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, streak_days integer NOT NULL DEFAULT 0, last_activity_date date, streak_freeze_used_on date);
CREATE TABLE public.study_days (user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, day date NOT NULL, PRIMARY KEY(user_id,day));
CREATE TABLE public.activities (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), activity_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.user_vocabulary (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), last_reviewed_at timestamptz);
CREATE TABLE public.user_lessons (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), completed_at timestamptz);
