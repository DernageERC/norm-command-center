-- 0001_mvp.sql
-- Lightweight MVP schema for Norm Network

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  photo_url text,
  city text,
  bio text,
  what_building text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  open_to text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.availability_status as enum ('open_connect', 'focus', 'hidden');

create table if not exists public.availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.availability_status not null default 'hidden',
  is_visible boolean not null default false,
  visibility_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.presence_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  geohash text not null,
  lat_approx numeric(9,6),
  lng_approx numeric(9,6),
  accuracy_m integer,
  captured_at timestamptz not null default now()
);
create index if not exists idx_presence_user_time on public.presence_locations(user_id, captured_at desc);
create index if not exists idx_presence_geohash_time on public.presence_locations(geohash, captured_at desc);

create type public.request_status as enum ('pending', 'accepted', 'declined', 'ignored', 'expired', 'cancelled');

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  status public.request_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_user_id <> receiver_user_id)
);
create index if not exists idx_conn_requests_receiver on public.connection_requests(receiver_user_id, status, created_at desc);
create unique index if not exists idx_unique_pending_request on public.connection_requests(sender_user_id, receiver_user_id) where status = 'pending';

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);
create unique index if not exists idx_unique_connection_pair
on public.connections (least(user_a_id, user_b_id), greatest(user_a_id, user_b_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_connection_time on public.messages(connection_id, created_at desc);

create table if not exists public.blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

alter table public.profiles enable row level security;
alter table public.availability enable row level security;
alter table public.presence_locations enable row level security;
alter table public.connection_requests enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;

-- Profiles: own read/write
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id);

-- Availability: own read/write
create policy "availability_select_own" on public.availability
for select using (auth.uid() = user_id);
create policy "availability_insert_own" on public.availability
for insert with check (auth.uid() = user_id);
create policy "availability_update_own" on public.availability
for update using (auth.uid() = user_id);

-- Presence: own insert/read + discoverable read for visible users (coarse)
create policy "presence_insert_own" on public.presence_locations
for insert with check (auth.uid() = user_id);
create policy "presence_select_own" on public.presence_locations
for select using (auth.uid() = user_id);
create policy "presence_select_visible_users" on public.presence_locations
for select using (
  exists (
    select 1 from public.availability a
    where a.user_id = presence_locations.user_id
      and a.is_visible = true
      and (a.visibility_expires_at is null or a.visibility_expires_at > now())
  )
);

-- Requests: sender/receiver can read. sender creates. receiver or sender can update status.
create policy "requests_select_participants" on public.connection_requests
for select using (auth.uid() = sender_user_id or auth.uid() = receiver_user_id);
create policy "requests_insert_sender" on public.connection_requests
for insert with check (auth.uid() = sender_user_id);
create policy "requests_update_participants" on public.connection_requests
for update using (auth.uid() = sender_user_id or auth.uid() = receiver_user_id);

-- Connections: participants can read/write
create policy "connections_select_participants" on public.connections
for select using (auth.uid() in (user_a_id, user_b_id));
create policy "connections_insert_participants" on public.connections
for insert with check (auth.uid() in (user_a_id, user_b_id));

-- Messages: participants-only read/write
create policy "messages_select_participants" on public.messages
for select using (
  exists (
    select 1 from public.connections c
    where c.id = messages.connection_id
      and auth.uid() in (c.user_a_id, c.user_b_id)
  )
);
create policy "messages_insert_sender_participant" on public.messages
for insert with check (
  auth.uid() = sender_user_id and
  exists (
    select 1 from public.connections c
    where c.id = messages.connection_id
      and auth.uid() in (c.user_a_id, c.user_b_id)
  )
);

-- Blocks: own read/write
create policy "blocks_select_own" on public.blocks
for select using (auth.uid() = blocker_user_id);
create policy "blocks_insert_own" on public.blocks
for insert with check (auth.uid() = blocker_user_id);
create policy "blocks_delete_own" on public.blocks
for delete using (auth.uid() = blocker_user_id);
