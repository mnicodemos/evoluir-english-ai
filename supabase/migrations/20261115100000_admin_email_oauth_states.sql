-- OAuth handshakes are one-time, short-lived and server-only.
create table if not exists public.admin_email_oauth_states (
  nonce text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier_encrypted text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.admin_email_oauth_states enable row level security;
create index if not exists admin_email_oauth_states_expiry_idx
  on public.admin_email_oauth_states(expires_at);

alter table public.admin_email_connections
  add column if not exists delta_link text;
