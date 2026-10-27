-- Persist optional Real-Life Challenge progress across the user's devices.
-- This table is separate from lesson completion, quiz scores and checklists.
create table if not exists public.real_life_challenge_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_key text not null,
  selected_option_id text null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint real_life_challenge_progress_pkey primary key (user_id, lesson_key)
);

alter table public.real_life_challenge_progress enable row level security;

create policy "Users can read their own real-life challenge progress"
  on public.real_life_challenge_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own real-life challenge progress"
  on public.real_life_challenge_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own real-life challenge progress"
  on public.real_life_challenge_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.real_life_challenge_progress to authenticated;
