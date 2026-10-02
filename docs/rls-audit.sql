-- RLS AUDIT — Evoluir+ English AI
-- Purpose: point-in-time audit of Row Level Security for every table in `public`.
-- Run read-only (psql / SQL editor). No statements here change state.
--
-- 1. Tables WITHOUT RLS enabled (must be empty — every public table needs RLS)
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by 1;

-- 2. Policies per table (name, command, roles, expression)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. Grants hygiene: any DML granted to anon/authenticated on tables whose
--    RLS policies do not allow that command (defence in depth check)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by grantee, table_name, privilege_type;

-- 4. Tables readable by anon (verify each against product intent)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'SELECT'
order by table_name;

-- 5. Cross-user sanity: per-user tables must scope policies to auth.uid()
--    (manual review of query 2 output — look for policies whose qual/with_check
--    do not reference auth.uid() on user-owned tables).

-- 6. Sensitive columns exposed via Data API (known: quizzes.correct_answer)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quizzes'
order by ordinal_position;
