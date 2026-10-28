-- Persist Music Lab song metadata and private audio objects for each authenticated user.
create table if not exists public.music_lab_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 2 and 80),
  genre text not null check (genre in ('pop', 'acoustic', 'indie', 'R&B', 'rock', 'reggae', 'lofi')),
  goal text not null check (goal in (
    'everyday vocabulary',
    'pronunciation and rhythm',
    'phrasal verbs and expressions',
    'grammar in context'
  )),
  lyrics text not null,
  audio_path text not null unique,
  mime_type text not null default 'audio/mpeg',
  level text not null check (level in ('a1', 'a2', 'b1', 'b2', 'c1', 'c2')),
  created_at timestamptz not null default now()
);

create index if not exists music_lab_songs_user_created_idx
  on public.music_lab_songs (user_id, created_at desc);

alter table public.music_lab_songs enable row level security;

drop policy if exists "Users can read their own Music Lab songs" on public.music_lab_songs;
create policy "Users can read their own Music Lab songs"
  on public.music_lab_songs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.music_lab_songs to authenticated;
grant all on public.music_lab_songs to service_role;

-- The audio bucket is private. The API signs short-lived playback URLs after checking ownership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music-lab-audio', 'music-lab-audio', false, 10485760, null)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = null;

drop policy if exists "Users can read their own Music Lab audio" on storage.objects;
create policy "Users can read their own Music Lab audio"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'music-lab-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
