-- Persistent delivery status for transactional student email campaigns.
create table if not exists public.email_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign text not null check (campaign in ('welcome', 'premium-benefits')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'suppressed', 'failed')),
  recipient_email text not null,
  idempotency_key text not null unique,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign)
);

create index if not exists email_campaign_deliveries_user_idx
  on public.email_campaign_deliveries (user_id, created_at desc);

alter table public.email_campaign_deliveries enable row level security;
-- Access is restricted to the server-side service role. No client policies are created.
