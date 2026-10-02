-- 0028 — Roles foundation, answer-key column protection, privilege hygiene.
-- Single shared environment (preview + production); no separate staging exists.

-- 1. Roles stored in a dedicated table (never on profiles) to avoid privilege escalation.
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users can view own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- SECURITY DEFINER so role checks never recurse through RLS.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Seed the existing product admin (documented technical debt: authorization in
-- code still verifies the email claim server-side; user_roles is the DB source).
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = 'mncelo.n@gmail.com'
on conflict do nothing;

-- 2. Answer-key protection at the column level: authenticated clients can never
--    SELECT quizzes.correct_answer through the Data API, regardless of app code.
revoke select on public.quizzes from authenticated;
grant select (id, lesson_id, question, question_type, options, explanation, sort_order, created_at, created_by, pedagogical_skill)
  on public.quizzes to authenticated;
revoke insert on public.quizzes from authenticated;
grant insert (id, lesson_id, question, question_type, options, correct_answer, explanation, sort_order, created_at, created_by, pedagogical_skill)
  on public.quizzes to authenticated;
grant select, insert, update, delete on public.quizzes to service_role;

-- 3. Privilege hygiene: anon has no policies on any public table, so all its DML
--    grants are dead surface. Authenticated DML grants on tables whose RLS denies
--    every write are revoked as well — all verified writes to those tables go
--    through privileged server-side clients.
revoke insert, update, delete on all tables in schema public from anon;

revoke insert, update, delete
  on public.activities,
     public.ai_limits,
     public.ai_response_cache,
     public.ai_usage_events,
     public.assessment_evidence,
     public.assessment_sessions,
     public.assessment_skill_results,
     public.entitlements,
     public.learning_errors,
     public.pedagogical_dual_write_failures,
     public.progress,
     public.quiz_results,
     public.stripe_customers,
     public.stripe_webhook_events,
     public.subscriptions,
     public.writing_submissions
  from authenticated;
