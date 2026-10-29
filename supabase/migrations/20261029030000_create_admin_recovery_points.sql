-- Admin-only registry of Git recovery points. This stores checkpoint metadata,
-- not a database backup and not an automated restore mechanism.
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

-- All reads and writes go through admin-verified server functions using the
-- server-only Supabase client. No direct Data API access is granted.
revoke all on public.admin_recovery_points from anon, authenticated;

comment on table public.admin_recovery_points is
  'Administrative registry of Git-based recovery points; not a database backup.';
comment on column public.admin_recovery_points.commit_sha is
  'Exact Git commit to use as the source for code recovery.';
comment on column public.admin_recovery_points.environment is
  'Application environment associated with this checkpoint; does not imply a DB snapshot.';

insert into public.admin_recovery_points
  (title, description, repository, branch_name, commit_sha, source_pr, environment)
values
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
