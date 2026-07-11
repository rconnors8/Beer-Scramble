-- Golf Beer League — Supabase migration
--
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- It creates the tables, RLS policies, and the two atomic-cap RPCs.
--
-- Enforcement model:
--   * Reads are public (spectators + leaderboard use the anon key).
--   * Writes are client-side, gated by RLS keyed on auth.uid().
--   * The two actions needing an atomic cap check — joining a team and
--     logging a beer — go through SECURITY DEFINER functions.
--   * hole_scores has NO update/delete policy and a unique(team_id, hole_number)
--     constraint, which together make a submitted score permanently locked.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_code text unique not null,        -- short shareable code, e.g. 6 uppercase chars
  course_name text,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_name text not null,
  members_label text,                     -- optional free text, e.g. "Mike & Dave"
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists hole_scores (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  strokes int not null check (strokes between 1 and 10),
  par int check (par between 3 and 5),
  submitted_at timestamptz not null default now(),
  unique (team_id, hole_number)   -- resubmitting a hole is rejected: scores are immutable
);

create table if not exists beer_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  logged_at timestamptz not null default now()
);

create index if not exists teams_match_idx on teams (match_id);
create index if not exists hole_scores_team_idx on hole_scores (team_id);
create index if not exists beer_logs_team_idx on beer_logs (team_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table matches     enable row level security;
alter table teams       enable row level security;
alter table hole_scores enable row level security;
alter table beer_logs   enable row level security;

-- Public reads on everything (spectators + leaderboard).
create policy matches_select     on matches     for select using (true);
create policy teams_select       on teams       for select using (true);
create policy hole_scores_select on hole_scores for select using (true);
create policy beer_logs_select   on beer_logs   for select using (true);

-- matches: authenticated users may create a match they own. No update/delete.
create policy matches_insert on matches
  for insert to authenticated
  with check (owner_user_id = auth.uid());

-- hole_scores: insert only for a hole belonging to a team you own. No update/delete.
create policy hole_scores_insert on hole_scores
  for insert to authenticated
  with check (
    exists (
      select 1 from teams t
      where t.id = hole_scores.team_id
        and t.owner_user_id = auth.uid()
    )
  );

-- teams and beer_logs have NO insert/update/delete policies: all writes go
-- through the SECURITY DEFINER RPCs below, which enforce the caps atomically.

-- ---------------------------------------------------------------------------
-- RPC: join_team — enforces the 8-team cap, dedupes by owner
-- ---------------------------------------------------------------------------

create or replace function join_team(
  p_match_id uuid,
  p_team_name text,
  p_members_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  -- If this account already owns a team in this match, return it (no duplicate).
  select id into v_team_id
  from teams
  where match_id = p_match_id and owner_user_id = auth.uid();
  if v_team_id is not null then
    return v_team_id;
  end if;

  select count(*) into v_count from teams where match_id = p_match_id;
  if v_count >= 8 then
    raise exception 'match is full';
  end if;

  insert into teams (match_id, team_name, members_label, owner_user_id)
  values (p_match_id, p_team_name, p_members_label, auth.uid())
  returning id into v_team_id;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: log_beer — enforces the 30-beer cap atomically
-- ---------------------------------------------------------------------------

create or replace function log_beer(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_owner uuid;
begin
  select owner_user_id into v_owner from teams where id = p_team_id;
  if v_owner is distinct from auth.uid() then
    raise exception 'not your team';
  end if;

  select count(*) into v_count from beer_logs where team_id = p_team_id;
  if v_count >= 30 then
    raise exception 'beer cap reached';
  end if;

  insert into beer_logs (team_id) values (p_team_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: undo_last_beer — removes the caller's most recent beer within the
-- undo window. Beers are explicitly undoable (only *scores* are immutable),
-- and beer_logs has no delete policy, so this SECURITY DEFINER function is
-- how the undo toast walks back the last log.
-- ---------------------------------------------------------------------------

create or replace function undo_last_beer(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select owner_user_id into v_owner from teams where id = p_team_id;
  if v_owner is distinct from auth.uid() then
    raise exception 'not your team';
  end if;

  select id into v_id
  from beer_logs
  where team_id = p_team_id
  order by logged_at desc
  limit 1;

  if v_id is not null then
    delete from beer_logs where id = v_id;
  end if;
end;
$$;

grant execute on function join_team(uuid, text, text)   to authenticated;
grant execute on function log_beer(uuid)                to authenticated;
grant execute on function undo_last_beer(uuid)          to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (leaderboard + team dashboard subscribe to these)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table hole_scores;
alter publication supabase_realtime add table beer_logs;
alter publication supabase_realtime add table teams;
