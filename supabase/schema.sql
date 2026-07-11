-- Beer-Scramble database schema
--
-- Auth model: Supabase Google OAuth. There is NO custom backend — the browser
-- talks directly to Postgres and every rule below is enforced by the database
-- itself (constraints + RLS + triggers), so a hand-rolled client cannot get
-- around it.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  -- short human-shareable code so teams can find the match
  join_code  text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  -- Team names are intentionally NOT unique: collisions are allowed.
  name       text not null check (char_length(name) between 1 and 60),
  -- 30-beer HARD CAP, enforced by the database. No client can push past it.
  beer_count int  not null default 0 check (beer_count >= 0 and beer_count <= 30),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  hole       int  not null check (hole between 1 and 18),
  strokes    int  not null check (strokes between 1 and 20),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  -- One score per hole per team. Combined with the insert-only RLS policy
  -- below, this makes a submitted score FINAL: it cannot be edited or replaced.
  unique (team_id, hole)
);

create index if not exists scores_match_idx on public.scores (match_id);
create index if not exists teams_match_idx  on public.teams  (match_id);

-- ---------------------------------------------------------------------------
-- Guard trigger for teams
--   * beer_count is the only column that may change after creation
--   * beer_count may only go UP (no quietly walking it back)
--   The 0..30 CHECK constraint above still provides the hard ceiling.
-- ---------------------------------------------------------------------------

create or replace function public.teams_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.name <> old.name
     or new.match_id <> old.match_id
     or new.created_by <> old.created_by then
    raise exception 'Only beer_count may be updated on a team';
  end if;
  if new.beer_count < old.beer_count then
    raise exception 'beer_count cannot decrease';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_guard on public.teams;
create trigger teams_guard
  before update on public.teams
  for each row execute function public.teams_guard_update();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.teams   enable row level security;
alter table public.scores  enable row level security;

-- Matches: any signed-in user may read and create. No update/delete — there is
-- no "match over" toggle and nothing about a match is editable after creation.
create policy matches_select on public.matches
  for select to authenticated using (true);
create policy matches_insert on public.matches
  for insert to authenticated with check (created_by = auth.uid());

-- Teams: read all (needed for the leaderboard), create your own, and update
-- (only beer_count gets through, per the guard trigger). No delete.
create policy teams_select on public.teams
  for select to authenticated using (true);
create policy teams_insert on public.teams
  for insert to authenticated with check (created_by = auth.uid());
create policy teams_update on public.teams
  for update to authenticated using (true) with check (true);

-- Scores: read all, INSERT only. No update and no delete policy exists, so once
-- a row lands it is permanent — a submitted score is final for everyone,
-- including the match creator.
create policy scores_select on public.scores
  for select to authenticated using (true);
create policy scores_insert on public.scores
  for insert to authenticated with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime (so leaderboards update live across phones)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.teams;
