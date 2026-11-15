-- Admin email inbox: service-role only. OAuth tokens are encrypted by the server before storage.
create table if not exists public.admin_email_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'microsoft'),
  mailbox_email text not null,
  connected_by uuid not null references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists admin_email_connections_active_provider_idx
  on public.admin_email_connections(provider) where revoked_at is null;

create table if not exists public.admin_email_messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  provider_conversation_id text,
  mailbox text not null check (mailbox in ('contact','support','unknown')),
  from_address text not null,
  to_addresses text[] not null default '{}',
  subject text not null default '',
  body_text text not null default '',
  received_at timestamptz not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_email_messages_received_idx
  on public.admin_email_messages(received_at desc);
create index if not exists admin_email_messages_conversation_idx
  on public.admin_email_messages(provider_conversation_id);

alter table public.admin_email_connections enable row level security;
alter table public.admin_email_messages enable row level security;
-- No client policies: only trusted server code using the service role can access these tables.
