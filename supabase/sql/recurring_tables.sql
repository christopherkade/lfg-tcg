-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds the "Organiser" surface: local game stores can self-serve onboard
-- via an unlisted /organizer/apply route (see src/app/actions/organizer.ts),
-- then define recurring weekly tables (e.g. "Friday Night Magic") that
-- automatically spawn real, joinable `pods` rows on schedule instead of
-- being re-created by hand every week.
--
-- This script also patches three earlier functions/jobs (rate_limits.sql's
-- enforce_pod_creation_cooldown, schema.sql's notify_on_pod_join_insert,
-- inactive_pod_cleanup.sql's sweep-inactive-active-pods job) so the new
-- cron-driven spawn path coexists correctly with existing invariants — see
-- SPECS.md for the full rationale.

-- ============================================================
-- 0. Reset — makes this whole script safe to re-run from scratch.
--
--    This feature has not been applied to any environment yet (see
--    supabase/MANIFEST.md, both checkboxes unticked), so there is no real
--    data to lose here, unlike schema.sql's own equivalent DROP block.
--    Every CREATE TABLE below is a plain (non-idempotent) statement, so
--    without this, re-running the script after a partial failure (or an
--    earlier draft of it) fails with "relation already exists" on the
--    very first CREATE — which is exactly the error this fixes. Drops
--    everything the rest of the script creates/touches, in dependency
--    order (columns before the tables they reference, so the later
--    `ADD COLUMN IF NOT EXISTS ... REFERENCES ...` statements actually
--    re-run and restore their foreign keys instead of silently no-op'ing
--    against a column that survived with a now-dangling constraint).
--    Remove this block once the feature has real data in some
--    environment and this script is only ever applied once per
--    environment, per MANIFEST's normal rule.
-- ============================================================
drop trigger if exists snapshot_recurring_pod_history_trigger on pods;
drop function if exists snapshot_recurring_pod_history();
drop function if exists spawn_due_recurring_pods();
drop function if exists next_recurring_occurrence(smallint, time);
-- Delete any already-spawned OR orphaned organiser pod BEFORE dropping the
-- columns below, not after. Dropping+re-adding recurring_table_id/
-- store_name/auto_accept wipes them back to NULL/false on every existing
-- row, but max_players (a separate, never-dropped column) is left
-- untouched — a pod spawned with max_players=20 would survive with
-- store_name=NULL, immediately violating the store_name-keyed
-- pods_max_players_check added further down this same script. Matches on
-- `recurring_table_id is not null OR store_name is not null` (not just the
-- former) so an already-orphaned pod (recurring_table_id nulled by an
-- earlier ON DELETE SET NULL, store_name/max_players untouched — the exact
-- shape that was leaking into OwnPodPanel on /pods) is also cleaned up, not
-- just currently-linked ones. Guarded by a column-existence check since
-- recurring_table_id doesn't exist yet on a genuinely fresh apply (this
-- script itself adds it, in section 3 below).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'pods' and column_name = 'recurring_table_id'
  ) then
    delete from pods where recurring_table_id is not null or store_name is not null;
  end if;
end $$;
alter table pod_history drop column if exists recurring_table_id;
alter table pod_history drop column if exists store_name;
alter table pods drop column if exists recurring_table_id cascade; -- cascades to pods_one_active_per_recurring_occurrence, rebuilt below
alter table pods drop column if exists auto_accept;
alter table pods drop column if exists store_name cascade; -- cascades to pods_one_active_per_user (now keyed on store_name, not recurring_table_id), rebuilt below
drop table if exists recurring_tables cascade;
drop table if exists organizers cascade;

-- ============================================================
-- 1. organizers — 1:1 professional-role table (not a profiles.role column)
-- ============================================================
create table organizers (
  id uuid references profiles(id) on delete cascade primary key,
  store_name text not null check (length(store_name) between 1 and 80),
  city text not null,
  description text check (description is null or length(description) <= 500),
  -- Google Maps link, store website, or similar proof of a real, physical
  -- store — since onboarding is otherwise fully self-serve (no invite code
  -- or approval step), this is the only signal available to spot-check a
  -- submission after the fact.
  verification_url text not null check (length(verification_url) between 1 and 500),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table organizers enable row level security;

create policy "organizers_select_own" on organizers
  for select to authenticated using (id = auth.uid());

-- Self-serve: the ONLY gate is that /organizer/apply is an unlisted route
-- shared directly by the developer with trusted stores — no invite code or
-- approval step exists. Any authenticated user who reaches the route/action
-- can insert their own row. Fast-follow if this link ever leaks: add an
-- invite-code check inside applyAsOrganizer (app code), no schema change
-- needed for that.
create policy "organizers_insert_self" on organizers
  for insert to authenticated with check (id = auth.uid());

create policy "organizers_update_own" on organizers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- 2. recurring_tables — the weekly schedule definition
-- ============================================================
create table recurring_tables (
  id uuid default gen_random_uuid() primary key,
  organizer_id uuid references organizers(id) on delete cascade not null,
  store_name text not null,          -- snapshot of organizers.store_name at creation time, same denormalize-at-write convention as pods.city
  game_key text not null,
  format_key text not null,
  playstyle_key text not null default 'casual',
  power_tiers int[] check (power_tiers is null or power_tiers <@ array[1,2,3,4,5]),
  type match_type not null default 'IRL', -- app-level validator restricts to IRL only for MVP; column kept for future online leagues
  location_name text not null,
  city text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Sunday..6=Saturday, matches JS Date#getDay()
  start_time time not null,          -- naive wall-clock, same no-explicit-timezone convention as pods.scheduled_at
  end_time time not null,            -- used to compute each spawned pod's real expires_at (and expire-past-recurring-pods' trigger) instead of a flat guess; <= start_time means the event spans midnight
  max_players int not null default 4 check (max_players between 2 and 200), -- a store's table can run much larger than an ad hoc pod's 2-6 cap (see the matching pods_max_players_check patch below)
  notes text check (notes is null or length(notes) <= 300),
  auto_accept boolean not null default false,
  lead_time_hours int not null default 72 check (lead_time_hours between 1 and 336),
  is_active boolean not null default true, -- organiser pause switch, distinct from delete
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table recurring_tables enable row level security;

create policy "recurring_tables_select_active_or_own" on recurring_tables
  for select to authenticated using (is_active = true or organizer_id = auth.uid());

create policy "recurring_tables_insert_own" on recurring_tables
  for insert to authenticated with check (
    organizer_id = auth.uid()
    and exists (select 1 from organizers where id = auth.uid() and is_active = true)
  );

create policy "recurring_tables_update_own" on recurring_tables
  for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

create policy "recurring_tables_delete_own" on recurring_tables
  for delete to authenticated using (organizer_id = auth.uid());

-- ============================================================
-- 3. pods additions
-- ============================================================
alter table pods add column if not exists recurring_table_id uuid references recurring_tables(id) on delete set null;
alter table pods add column if not exists auto_accept boolean not null default false;
alter table pods add column if not exists store_name text; -- null for ad hoc peer-hosted pods

-- pods.max_players' original CHECK (schema.sql, auto-named pods_max_players_check)
-- caps every row in this shared table at 2-6 — fine for an ad hoc pod, far
-- too small for a store's recurring table (a league night, a big FNM).
-- Re-scope it instead of just widening the bound globally, so ad hoc pods
-- stay DB-capped at 6. Idempotent drop-then-add, safe to re-run any time
-- (pods itself is never dropped by the reset block above, unlike
-- organizers/recurring_tables).
--
-- Keyed on store_name, NOT recurring_table_id: recurring_table_id is
-- ON DELETE SET NULL (below), so deleting a recurring table with an
-- already-spawned pod fires that SET NULL as an UPDATE on the pod itself —
-- which must re-satisfy this CHECK. If it were keyed on
-- `recurring_table_id is null`, that same delete would flip a max_players=20
-- pod straight into the "must be 2-6" branch and fail the delete outright.
-- store_name has no FK/ON DELETE action — it's set once at spawn time and
-- never changes — so it stays a stable, permanent signal for "this pod
-- originated from an organiser" even after its source recurring_tables row
-- is gone.
alter table pods drop constraint if exists pods_max_players_check;
alter table pods add constraint pods_max_players_check check (
  (store_name is null and max_players between 2 and 6)
  or (store_name is not null and max_players between 2 and 200)
);

-- ============================================================
-- 4. Scope pods_one_active_per_user to ad hoc pods only, and guarantee
--    spawn idempotency per recurring table occurrence.
--
--    Without this, an organiser running >=1 recurring table (or a
--    recurring table plus their own personal LFG search) would violate the
--    original unqualified unique index the moment a second ACTIVE pod with
--    the same user_id exists.
--
--    Keyed on store_name, not recurring_table_id: the latter is
--    ON DELETE SET NULL (below), so once an organiser deletes a recurring
--    table out from under an already-spawned pod, that pod's
--    recurring_table_id goes null while store_name/max_players don't — if
--    this index (and every other "is this my personal ad hoc pod" check:
--    fetchOwnPodData, LfgButton, createPod, requestJoin) stayed keyed on
--    recurring_table_id, that now-orphaned 20-player store pod would
--    silently qualify as the organiser's own ad hoc pod again, both
--    colliding with this uniqueness constraint and leaking into
--    OwnPodPanel/MyPodPanel on /pods (a real bug hit in testing).
-- ============================================================
drop index if exists pods_one_active_per_user;
create unique index pods_one_active_per_user on pods(user_id)
  where status = 'ACTIVE' and store_name is null;

create unique index pods_one_active_per_recurring_occurrence on pods(recurring_table_id, scheduled_at)
  where status = 'ACTIVE' and recurring_table_id is not null;

-- ============================================================
-- 5. Spawn logic
--
--    Timezone handling mirrors validateStartSearchInput
--    (src/lib/pods/validateStartSearch.ts) exactly: that code builds
--    scheduled_at via `new Date(`${date}T${time}`).toISOString()` inside a
--    Node/Vercel server action, i.e. it treats the typed wall-clock time as
--    if it were UTC, with no explicit timezone conversion anywhere in the
--    app today. next_recurring_occurrence reproduces the same arithmetic
--    rather than inventing real timezone math that would disagree with ad
--    hoc pods.
-- ============================================================
create or replace function public.next_recurring_occurrence(
  _day_of_week smallint,
  _start_time time
) returns timestamptz
language plpgsql
stable
as $$
declare
  v_days_ahead int;
  v_candidate timestamptz;
begin
  -- extract(dow from ...) returns 0=Sunday..6=Saturday, same convention as
  -- JS Date#getDay() — matches day_of_week's stored meaning 1:1.
  v_days_ahead := (_day_of_week - extract(dow from now() at time zone 'UTC')::int + 7) % 7;
  v_candidate := (date_trunc('day', now() at time zone 'UTC') + (v_days_ahead || ' days')::interval + _start_time) at time zone 'UTC';

  if v_candidate < now() then
    v_candidate := v_candidate + interval '7 days';
  end if;

  return v_candidate;
end;
$$;

create or replace function public.spawn_due_recurring_pods()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rt record;
  v_scheduled_at timestamptz;
  v_ends_at timestamptz;
begin
  for rt in select * from recurring_tables where is_active = true loop
    v_scheduled_at := public.next_recurring_occurrence(rt.day_of_week, rt.start_time);

    -- Same wall-clock-as-UTC arithmetic as next_recurring_occurrence, just
    -- anchored to the occurrence's own date instead of "today". <= start_time
    -- means the event spans midnight (e.g. 22:00 -> 01:00), so roll to the
    -- next calendar day.
    v_ends_at := (date_trunc('day', v_scheduled_at at time zone 'UTC') + rt.end_time) at time zone 'UTC';
    if rt.end_time <= rt.start_time then
      v_ends_at := v_ends_at + interval '1 day';
    end if;

    if v_scheduled_at <= now() + (rt.lead_time_hours || ' hours')::interval then
      insert into pods (
        user_id, game_key, format_key, playstyle_key, power_tiers, type,
        location_name, city, scheduled_at, expires_at, max_players, notes,
        recurring_table_id, auto_accept, store_name
      )
      values (
        rt.organizer_id, rt.game_key, rt.format_key, rt.playstyle_key, rt.power_tiers, rt.type,
        rt.location_name, rt.city, v_scheduled_at,
        v_ends_at, -- the occurrence's real end time, NOT a flat scheduled_at+4h guess (see SPECS.md rationale)
        rt.max_players, rt.notes, rt.id, rt.auto_accept, rt.store_name
      )
      on conflict do nothing; -- backstop; pods_one_active_per_recurring_occurrence is the hard guarantee
    end if;
  end loop;
end;
$$;

-- ============================================================
-- 6. Patch enforce_pod_creation_cooldown (originally rate_limits.sql) to
--    exempt cron-spawned rows — otherwise two recurring tables due in the
--    same hourly run would have their second insert rejected by the 15s
--    per-user_id cooldown.
-- ============================================================
create or replace function enforce_pod_creation_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if new.recurring_table_id is not null then
    return new; -- cron-driven; already deduplicated by pods_one_active_per_recurring_occurrence
  end if;

  select last_pod_created_at into v_last from profiles where id = new.user_id;

  if v_last is not null and v_last > now() - interval '15 seconds' then
    raise exception 'RATE_LIMITED_POD_CREATE';
  end if;

  update profiles set last_pod_created_at = now() where id = new.user_id;
  return new;
end;
$$;

-- ============================================================
-- 7. Patch notify_on_pod_join_insert (originally schema.sql) so an
--    auto-accepted join — inserted directly as ACCEPTED by requestJoin,
--    never passing through the PENDING->ACCEPTED update that
--    notify_on_pod_join_update listens for — still notifies the joiner.
-- ============================================================
create or replace function public.notify_on_pod_join_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    _host_id uuid;
begin
    select user_id into _host_id from pods where id = new.pod_id;
    if _host_id is null then
      return new;
    end if;

    if new.status = 'ACCEPTED' then
      insert into notifications (recipient_id, actor_id, type, pod_id)
      values (new.user_id, _host_id, 'JOIN_ACCEPTED', new.pod_id);
    else
      insert into notifications (recipient_id, actor_id, type, pod_id)
      values (_host_id, new.user_id, 'JOIN_REQUEST', new.pod_id);
    end if;
    return new;
end;
$$;

-- ============================================================
-- 8. Table history — extend pod_history rather than build a second
--    mechanism. Recurring pods aren't manually "marked matched" by an
--    organiser (that's an ad hoc-pod concept); they lapse to EXPIRED after
--    the event via the cron job below. A second, parallel trigger (kept
--    separate from snapshot_pod_history's ACTIVE->MATCHED trigger so it
--    can never interfere with the ad hoc "Past Pods" feature or
--    MatchedPodWatcher's dialog) logs the occurrence on ACTIVE->EXPIRED,
--    scoped to recurring-linked pods only.
-- ============================================================
alter table pod_history add column if not exists recurring_table_id uuid references recurring_tables(id) on delete set null;
alter table pod_history add column if not exists store_name text;

create or replace function snapshot_recurring_pod_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'ACTIVE' and new.status = 'EXPIRED' and new.recurring_table_id is not null then
    insert into pod_history (
      pod_id, host_id, game_key, format_key, playstyle_key, power_tiers,
      type, location_name, city, scheduled_at, pod_created_at, matched_at,
      recurring_table_id, store_name, members
    )
    select
      new.id, new.user_id, new.game_key, new.format_key, new.playstyle_key,
      new.power_tiers, new.type, new.location_name, new.city, new.scheduled_at,
      new.created_at,
      new.scheduled_at, -- repurposed as "when this occurrence happened"; no separate column needed
      new.recurring_table_id, new.store_name,
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

drop trigger if exists snapshot_recurring_pod_history_trigger on pods;
create trigger snapshot_recurring_pod_history_trigger
  after update on pods
  for each row
  when (old.status = 'ACTIVE' and new.status = 'EXPIRED' and new.recurring_table_id is not null)
  execute function snapshot_recurring_pod_history();

-- ============================================================
-- 9. Cron jobs
-- ============================================================
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'spawn-recurring-table-pods';
select cron.schedule(
  'spawn-recurring-table-pods',
  '0 * * * *', -- top of every hour
  $$ select public.spawn_due_recurring_pods(); $$
);

-- Flips a spawned pod's occurrence to EXPIRED once its real end time
-- (expires_at, computed from end_time above — not a flat guess) has passed
-- (organisers won't click "Mark Matched" for a whole table). This plain
-- UPDATE is also what drives the history trigger above — no separate call
-- needed. The row then falls into the EXISTING sweep-matched-expired-pods
-- job's "EXPIRED, expires_at < now()-24h" branch for eventual deletion.
select cron.unschedule(jobid) from cron.job where jobname = 'expire-past-recurring-pods';
select cron.schedule(
  'expire-past-recurring-pods',
  '0 * * * *', -- top of every hour
  $$
  update pods set status = 'EXPIRED'
  where status = 'ACTIVE' and recurring_table_id is not null
    and expires_at < now();
  $$
);

-- Re-patch sweep-inactive-active-pods (originally inactive_pod_cleanup.sql)
-- to exempt recurring pods, which are legitimately created up to
-- lead_time_hours (days) ahead of their event and would otherwise be
-- wrongly deleted by the 12h-since-created_at rule.
select cron.unschedule(jobid) from cron.job where jobname = 'sweep-inactive-active-pods';
select cron.schedule(
  'sweep-inactive-active-pods',
  '0 * * * *', -- top of every hour
  $$
  with inactive as (
    select id, user_id
    from pods
    where status = 'ACTIVE'
      and created_at < now() - interval '12 hours'
      and recurring_table_id is null
  ),
  notify as (
    insert into notifications (recipient_id, actor_id, type, pod_id)
    select inactive.user_id, null, 'POD_EXPIRED_INACTIVITY', null
    from inactive
    union all
    select pod_joins.user_id, null, 'POD_EXPIRED_INACTIVITY', null
    from pod_joins
    join inactive on inactive.id = pod_joins.pod_id
    where pod_joins.status = 'ACCEPTED'
  )
  delete from pods using inactive
  where pods.id = inactive.id;
  $$
);
