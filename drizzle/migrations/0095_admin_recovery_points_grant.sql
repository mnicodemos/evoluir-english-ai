-- Admin → Recovery points (owner report, 2026-10-29: the tab did not work).
-- supabase/migrations/20261029030000 created the table without granting it to
-- service_role, which the server functions use (every other Admin table grants
-- it), and new files there are not applied by Lovable Publish on their own.
-- This migration makes the table exist with that grant. Idempotent: safe to
-- apply again; the two seeded checkpoints are inserted only once.
create table if not exists public.admin_recovery_points (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  repository text not null,
  branch_name text not null,
  commit_sha text not null,
  source_pr integer null,
  environment text not null default 'Lovable Cloud',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_recovery_points_commit_unique unique (repository, commit_sha),
  constraint admin_recovery_points_sha_check check (commit_sha ~ '^[0-9a-f]{7,40}$'),
  constraint admin_recovery_points_pr_check check (source_pr is null or source_pr > 0)
);

alter table public.admin_recovery_points enable row level security;

revoke all on public.admin_recovery_points from public, anon, authenticated;
grant all on public.admin_recovery_points to service_role;

insert into public.admin_recovery_points
  (title, description, repository, branch_name, commit_sha, source_pr, environment)
values
  (
    'Recovery point — after PR #504',
    'Previously established stable checkpoint. Preserves the 72.32px button size and centered alignment recorded at that stage.',
    'mnicodemos/evoluir-english-ai',
    'recovery-after-pr-504',
    '9d6097ee2dfbb88e8aff93454807c757223573a3',
    504,
    'Lovable Cloud'
  ),
  (
    'Recovery point — 2026-10-29 (after PR #554)',
    'Stable code checkpoint created before the admin recovery-points registry. PR #555 (mobile permanent jewels) was still open and is not included in this checkpoint.',
    'mnicodemos/evoluir-english-ai',
    'recovery-2026-10-29-after-pr-554',
    '75a8d5753be56b33629a931ca6f5fc3327c33186',
    554,
    'Lovable Cloud'
  )
on conflict (repository, commit_sha) do nothing;

NOTIFY pgrst, 'reload schema';
