-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds a durable "Past Pods" history log. Today, once a pod is marked
-- MATCHED it disappears from every screen (Active Pods / Match Feed both
-- filter on status = 'ACTIVE'), and the hourly sweep in
-- matched_pod_cleanup.sql permanently deletes it (cascading to pod_joins
-- and notifications) 24h after matched_at — so there is currently zero
-- durable record of a pod once it's been played. This script adds a
-- pod_history table that snapshots everything needed to render a history
-- entry, populated by a trigger that fires synchronously the moment a pod
-- transitions ACTIVE -> MATCHED, well before the cleanup sweep can ever
-- delete the source row. Only MATCHED pods are logged (not cancelled/
-- expired groups) — see SPECS.md's Past Pods section.
--
-- Also adds a per-viewer "delete from my history" affordance (`hidden_by`
-- + `hide_pod_history_entry`, see below) — since one row is shared by the
-- host and every accepted member, this is a soft-delete scoped to the
-- caller rather than a real DELETE that would erase the entry for everyone.

-- 1. Table: one row per pod that reached MATCHED, snapshotting everything
--    needed to render a history entry without needing the (soon to be
--    deleted) source pods/pod_joins rows.
create table if not exists pod_history (
    id uuid default gen_random_uuid() primary key,
    pod_id uuid not null,                 -- not FK'd: the pods row is deleted by the sweep; kept for reference only
    host_id uuid references profiles(id) on delete cascade not null,
    game_key text not null,
    format_key text not null,
    playstyle_key text not null,
    power_tiers int[],
    type match_type not null,
    location_name text,
    city text,
    scheduled_at timestamp with time zone,
    pod_created_at timestamp with time zone not null,
    matched_at timestamp with time zone not null,
    -- Snapshot of every ACCEPTED member at match time:
    -- [{ id, username, discord_handle, avatar_url }, ...]. host_id above is
    -- redundant with an entry here, but kept as a plain column since it's
    -- the primary thing every "who's in it" query/policy filters on.
    members jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone default now()
);

-- 1b. hidden_by: since a pod_history row is shared by the host and every
--     accepted member, a real DELETE from one person's "Past Pods" list
--     would erase it for everyone else too. Instead, deleting an entry is a
--     per-viewer soft-delete: their own id gets appended here, and the
--     SELECT policy below excludes any row where the caller's id appears
--     in it — the row (and everyone else's visibility of it) is untouched.
alter table pod_history add column if not exists hidden_by uuid[] not null default '{}';

-- 2. RLS: readable by the host and by anyone captured in the members
--    snapshot, excluding anyone who has hidden it for themselves. No
--    insert/update/delete policy for `authenticated` at all — every row is
--    created by the trigger below and hidden via the `hide_pod_history_entry`
--    SECURITY DEFINER function further down, mirroring the `notifications`
--    table's "no client-facing INSERT policy" convention.
alter table pod_history enable row level security;

drop policy if exists "pod_history readable by host or member" on pod_history;
create policy "pod_history readable by host or member"
  on pod_history for select
  using (
    not (auth.uid() = any(hidden_by))
    and (
      host_id = auth.uid()
      or exists (
        select 1 from jsonb_array_elements(members) as m
        where (m->>'id')::uuid = auth.uid()
      )
    )
  );

-- 3. Trigger: snapshot on ACTIVE -> MATCHED, before the row can ever be
--    deleted by the hourly sweep (matched_pod_cleanup.sql).
create or replace function snapshot_pod_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'ACTIVE' and new.status = 'MATCHED' then
    insert into pod_history (
      pod_id, host_id, game_key, format_key, playstyle_key, power_tiers,
      type, location_name, city, scheduled_at, pod_created_at, matched_at, members
    )
    select
      new.id, new.user_id, new.game_key, new.format_key, new.playstyle_key,
      new.power_tiers, new.type, new.location_name, new.city, new.scheduled_at,
      new.created_at, new.matched_at,
      coalesce(
        (select jsonb_agg(jsonb_build_object(
           'id', p.id, 'username', p.username,
           'discord_handle', p.discord_handle, 'avatar_url', p.avatar_url
         ))
         from pod_joins pj
         join profiles p on p.id = pj.user_id
         where pj.pod_id = new.id and pj.status = 'ACCEPTED'),
        '[]'::jsonb
      );
  end if;
  return new;
end;
$$;

-- WHEN mirrors the function body's own `if` above so Postgres skips the
-- function call (and its pod_joins/profiles join + jsonb_agg) entirely on
-- every pods UPDATE that isn't an ACTIVE -> MATCHED transition — matching
-- the WHEN-clause convention already used by schema.sql's own triggers
-- (pod_joins_notify_update/delete, pods_notify_update).
drop trigger if exists snapshot_pod_history_trigger on pods;
create trigger snapshot_pod_history_trigger
  after update on pods
  for each row
  when (old.status = 'ACTIVE' and new.status = 'MATCHED')
  execute function snapshot_pod_history();

-- 4. RPC: lets a viewer delete an entry from their own "Past Pods" list
--    without a client-facing UPDATE policy (which would otherwise need to
--    verify the caller only ever appends their own id and touches no other
--    column). Callable via `supabase.rpc("hide_pod_history_entry", { p_entry_id })`.
--    No-ops (returns without error) if the entry doesn't exist, isn't
--    visible to the caller, or was already hidden by them.
create or replace function hide_pod_history_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pod_history
  set hidden_by = array_append(hidden_by, auth.uid())
  where id = p_entry_id
    and not (auth.uid() = any(hidden_by))
    and (
      host_id = auth.uid()
      or exists (
        select 1 from jsonb_array_elements(members) as m
        where (m->>'id')::uuid = auth.uid()
      )
    );
end;
$$;

grant execute on function hide_pod_history_entry(uuid) to authenticated;

-- 5. RPC: total MATCHED pods a viewer has ever been part of (host or
--    accepted member), for the Profile screen's "Games Played" stat.
--    Deliberately ignores hidden_by — deleting an entry from your own
--    Past Pods list (Screen 4) is a personal declutter action, not an
--    undo of having actually played it, so this lifetime count shouldn't
--    shrink when an entry is hidden.
create or replace function get_games_played_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from pod_history
  where host_id = auth.uid()
     or exists (
       select 1 from jsonb_array_elements(members) as m
       where (m->>'id')::uuid = auth.uid()
     );
$$;

grant execute on function get_games_played_count() to authenticated;
