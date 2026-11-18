-- Delivery ledger for recurring student retention emails.
-- Separate from email_campaign_deliveries because reactivation supports
-- multiple milestones and multiple inactivity cycles per student.
create table if not exists public.reactivation_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_days integer not null check (milestone_days in (2, 4, 7, 14, 30)),
  inactivity_cycle_key text not null unique,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'pending', 'sent', 'delivered', 'opened', 'clicked', 'suppressed', 'failed')),
  recipient_email text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reactivation_email_deliveries_created_idx
  on public.reactivation_email_deliveries (created_at desc);
create index if not exists reactivation_email_deliveries_user_idx
  on public.reactivation_email_deliveries (user_id, created_at desc);

alter table public.reactivation_email_deliveries enable row level security;
-- Admin reads are performed server-side using the service role only.
