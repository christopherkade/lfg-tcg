-- PodFinder LFG PWA — schema, RLS, and realtime setup
-- Run this entire script in the Supabase SQL Editor (Project > SQL Editor > New query).
-- See docs/specs/03-schema.md for rationale.
--
-- WARNING: This script starts with DROP statements so it can be re-run cleanly
-- during development. Re-running it deletes all existing profiles/pods/joins
-- data. Remove the DROP block below before running against a project with real
-- user data you want to keep.
--
-- This is the baseline schema only — every post-baseline addition (rate
-- limit columns, matched_at/matched_notified_at, reserved_slots, pod_history, the newer
-- notify_pending_joiners_on_pod_update/notify_pod_destroyed triggers, the
-- scale_indexes.sql indexes) has its own tracked, additive script under
-- supabase/sql/*.sql and is layered on top of this one, not folded in here.
-- Run this script first, then every script in supabase/sql/ (any order,
-- except account_deletion.sql/matched_notification_seen.sql/etc. have no
-- ordering dependency on each other).

drop table if exists notifications cascade;
drop table if exists pod_joins cascade;
drop table if exists pods cascade;
drop table if exists profiles cascade;
drop type if exists notification_type cascade;
drop type if exists join_status cascade;
drop type if exists match_type cascade;
drop function if exists public.is_accepted_pod_member(uuid) cascade;
drop function if exists public.notify_on_pod_join_insert() cascade;
drop function if exists public.notify_on_pod_join_update() cascade;
drop function if exists public.notify_on_pod_join_delete() cascade;
drop function if exists public.notify_on_pod_update() cascade;

-- Baseline system enums
create type match_type as enum ('IRL', 'ONLINE');
create type join_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');
create type notification_type as enum (
    'JOIN_REQUEST',    -- someone requested to join your active pod (host)
    'JOIN_ACCEPTED',    -- your join request was accepted (joiner)
    'JOIN_REJECTED',    -- your join request was rejected (joiner)
    'MEMBER_LEFT',      -- an accepted member left your pod (host)
    'POD_UPDATED'    -- the host updated the pod's details (accepted members)
);

-- 1. Profiles Table (stores user identity, plus the LAST-used LFG search
-- settings — game, format, playstyle, acceptable power brackets, match type,
-- location, and group size. These are edited via the "Search" dialog on the
-- LFG tab, not on the Profile screen, and are persisted here so the dialog
-- can pre-fill with the previous search and the Match Feed keeps filtering
-- meaningfully. All columns have sensible defaults so a brand new profile
-- row — created with only id/username/discord_handle — is valid immediately,
-- without requiring the user to have opened the search dialog first.)
create table profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone default now(),
    username text unique not null,
    discord_handle text not null,
    avatar_url text,
    city text,                                           -- key into CITIES_CONFIG (constants/citiesConfig.ts), optional (NULL if unset, e.g. Online-only players)
    preferred_game text not null default 'MTG',
    preferred_format text not null default 'COMMANDER',
    preferred_playstyle text not null default 'casual',
    preferred_brackets int[] default array[1,2,3,4,5],
    preferred_match_type match_type not null default 'ONLINE',
    preferred_location_name text,
    preferred_max_players int not null default 2 check (preferred_max_players between 2 and 6),
    constraint bracket_conditional_check check (
        (preferred_game = 'MTG' and preferred_brackets is not null and array_length(preferred_brackets, 1) > 0 and preferred_brackets <@ array[1,2,3,4,5])
        or
        (preferred_game != 'MTG' and (preferred_brackets is null or array_length(preferred_brackets, 1) is null))
    ),
    constraint location_conditional_check check (
        (preferred_match_type = 'IRL' and preferred_location_name is not null and length(trim(preferred_location_name)) > 0)
        or
        (preferred_match_type = 'ONLINE' and preferred_location_name is null)
    )
);

-- 2. Pods Table (active LFG requests, snapshotting the host's profile
-- settings at the moment the search was started)
create table pods (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references profiles(id) on delete cascade not null,
    game_key text not null,
    format_key text not null,
    playstyle_key text not null,
    power_tiers int[] check (power_tiers is null or power_tiers <@ array[1,2,3,4,5]),
    type match_type not null,
    location_name text,
    city text,                                           -- snapshot of profiles.city at creation/edit time; drives Match Feed IRL scoping (Section 6)
    scheduled_at timestamp with time zone,
    max_players int not null default 2 check (max_players between 2 and 6),
    notes text check (notes is null or length(notes) <= 300),
    status text default 'ACTIVE',
    created_at timestamp with time zone default now(),
    expires_at timestamp with time zone default (now() + interval '4 hours')
);

-- Enforce a single ACTIVE pod per user
create unique index pods_one_active_per_user on pods(user_id) where status = 'ACTIVE';

-- 3. Pod Joins (join requests, subject to host approval)
create table pod_joins (
    id uuid default gen_random_uuid() primary key,
    pod_id uuid references pods(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete cascade not null,
    status join_status not null default 'PENDING',
    joined_at timestamp with time zone default now(),
    constraint unique_user_pod unique (pod_id, user_id)
);

-- 4. Notifications (persisted, per-recipient notification center backing the
-- header bell — see the trigger functions below the RLS section for how rows
-- get inserted. Deliberately has no `message` column: display text is
-- composed client-side from `type` + the joined `actor`/`pod` rows, which
-- keeps copy easy to change/localize later without touching historical rows.)
create table notifications (
    id uuid default gen_random_uuid() primary key,
    recipient_id uuid references profiles(id) on delete cascade not null,
    actor_id uuid references profiles(id) on delete set null,
    type notification_type not null,
    pod_id uuid references pods(id) on delete cascade,
    read_at timestamp with time zone,
    created_at timestamp with time zone default now()
);

-- Powers the unread-count badge and the recency-ordered dropdown list.
create index notifications_recipient_unread_idx on notifications(recipient_id, read_at);
create index notifications_recipient_created_idx on notifications(recipient_id, created_at desc);

-- Row Level Security -------------------------------------------------------

alter table profiles enable row level security;
alter table pods enable row level security;
alter table pod_joins enable row level security;
alter table notifications enable row level security;

-- profiles
create policy "profiles_select_authenticated" on profiles
    for select to authenticated using (true);

create policy "profiles_insert_own" on profiles
    for insert to authenticated with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
    for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- pods
-- Accepted members (not just the host) can also see their pod once it
-- stops being ACTIVE (e.g. MATCHED). This matters for Supabase Realtime:
-- postgres_changes re-checks this SELECT policy against the NEW row for
-- every subscriber on every UPDATE. Without the accepted-member clause,
-- an accepted joiner's subscription would fail RLS the instant status
-- flips away from 'ACTIVE', so they'd never receive that change event —
-- their MatchedDialog would never fire, and their own Match Feed would
-- keep showing the now-stale ACTIVE card indefinitely (no event ever
-- arrives telling their client to refetch and drop it).
--
-- This check can't be a plain `exists (select 1 from pod_joins ...)`
-- inline in the policy: pod_joins' own SELECT policy queries `pods`
-- back (to check host ownership), so a direct subquery here creates a
-- cycle — pods policy -> pod_joins policy -> pods policy -> ...
-- Postgres detects this and raises "infinite recursion detected in policy
-- for relation pods". The fix is a SECURITY DEFINER helper function:
-- it runs as the (RLS-bypassing) function owner, so its internal query
-- against pod_joins does not re-trigger pod_joins' RLS policy,
-- breaking the cycle.
create or replace function public.is_accepted_pod_member(_pod_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from pod_joins
        where pod_joins.pod_id = _pod_id
        and pod_joins.user_id = auth.uid()
        and pod_joins.status = 'ACCEPTED'
    );
$$;

grant execute on function public.is_accepted_pod_member(uuid) to authenticated;

create policy "pods_select_active_or_own_or_accepted_member" on pods
    for select to authenticated using (
        status = 'ACTIVE'
        or user_id = auth.uid()
        or public.is_accepted_pod_member(pods.id)
    );

create policy "pods_insert_own" on pods
    for insert to authenticated with check (user_id = auth.uid());

create policy "pods_update_own" on pods
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- pod_joins
create policy "pod_joins_select_own_or_host_or_accepted" on pod_joins
    for select to authenticated using (
        status = 'ACCEPTED'
        or user_id = auth.uid()
        or exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    );

create policy "pod_joins_insert_not_own_pod" on pod_joins
    for insert to authenticated with check (
        user_id = auth.uid()
        and not exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    );

create policy "pod_joins_update_host_only" on pod_joins
    for update to authenticated using (
        exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    );

-- Lets a joiner leave a pod themselves (cancel a PENDING request or
-- leave after being ACCEPTED) by deleting their own join row.
create policy "pod_joins_delete_own" on pod_joins
    for delete to authenticated using (user_id = auth.uid());

-- notifications
-- No insert/delete policy for `authenticated` at all: every row is created
-- exclusively by the SECURITY DEFINER trigger functions below, which run
-- with the (RLS-bypassing) function owner's privileges. This means a user
-- can never fabricate a notification for someone else via the client, only
-- read/mark-read their own.
create policy "notifications_select_own" on notifications
    for select to authenticated using (recipient_id = auth.uid());

create policy "notifications_update_own" on notifications
    for update to authenticated using (recipient_id = auth.uid())
    with check (recipient_id = auth.uid());

-- Notification triggers -----------------------------------------------
-- Notifications are created by database triggers (not application code) so
-- every mutation path (server actions today, anything else tomorrow) gets
-- consistent notification coverage for free, without needing a loose
-- client-facing insert policy. Each function is SECURITY DEFINER for the
-- same reason as public.is_accepted_pod_member above: it needs to write
-- to `notifications` (no authenticated insert policy exists) and, for the
-- pods trigger, read `pod_joins` regardless of the caller's own RLS.

-- (a) Someone requests to join a pod -> notify the host.
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
    if _host_id is not null then
        insert into notifications (recipient_id, actor_id, type, pod_id)
        values (_host_id, new.user_id, 'JOIN_REQUEST', new.pod_id);
    end if;
    return new;
end;
$$;

create trigger pod_joins_notify_insert
    after insert on pod_joins
    for each row execute function public.notify_on_pod_join_insert();

-- (b) Host accepts/rejects a join request -> notify the joiner.
create or replace function public.notify_on_pod_join_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    _host_id uuid;
begin
    if new.status not in ('ACCEPTED', 'REJECTED') then
        return new;
    end if;

    select user_id into _host_id from pods where id = new.pod_id;
    insert into notifications (recipient_id, actor_id, type, pod_id)
    values (
        new.user_id,
        _host_id,
        (case when new.status = 'ACCEPTED' then 'JOIN_ACCEPTED' else 'JOIN_REJECTED' end)::notification_type,
        new.pod_id
    );
    return new;
end;
$$;

create trigger pod_joins_notify_update
    after update on pod_joins
    for each row
    when (old.status is distinct from new.status)
    execute function public.notify_on_pod_join_update();

-- (c) An accepted member leaves (deletes their own join row) -> notify the host.
-- Cancelling a still-PENDING request does not notify anyone (nothing to undo
-- from the host's perspective).
--
-- actor_id is looked up via a fresh `select ... from profiles`, not used
-- directly as old.user_id: this trigger also fires when a user's account is
-- deleted (delete_own_account, account_deletion.sql), since profiles ->
-- pod_joins cascades before this fires, and by then old.user_id's own
-- profiles row is already gone. Inserting a *new* notifications row with a
-- dangling actor_id violates notifications_actor_id_fkey (the FK's own ON
-- DELETE SET NULL only rewrites existing rows, it can't rescue a fresh
-- insert), so we fall back to null in that case instead.
create or replace function public.notify_on_pod_join_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    _host_id uuid;
    _actor_id uuid;
begin
    select user_id into _host_id from pods where id = old.pod_id;
    if _host_id is not null and _host_id <> old.user_id then
        select id into _actor_id from profiles where id = old.user_id;
        insert into notifications (recipient_id, actor_id, type, pod_id)
        values (_host_id, _actor_id, 'MEMBER_LEFT', old.pod_id);
    end if;
    return old;
end;
$$;

create trigger pod_joins_notify_delete
    after delete on pod_joins
    for each row
    when (old.status = 'ACCEPTED')
    execute function public.notify_on_pod_join_delete();

-- (d) Host edits their still-ACTIVE pod's details (via updatePod) ->
-- notify every currently-accepted member. Guarded by `new.status = old.status`
-- so this fires only for in-place field edits, not for the MATCHED/EXPIRED
-- status transitions handled by their own dedicated UX (MatchedDialog).
--
-- CAVEAT: this definition is a rename of this file's own pre-"pods"-rename
-- version (formerly notify_on_beacon_update), not a verified copy of
-- whatever notify_on_pod_update currently is on the live database —
-- supabase/sql/notify_pending_joiners_on_pod_update.sql's own header notes
-- that function's live source was never captured in this repo at the time
-- of the rename, so if it has drifted since, re-running this script would
-- silently roll it back. Diff against `pg_get_functiondef` on the live
-- project before relying on this to reproduce production exactly.
create or replace function public.notify_on_pod_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into notifications (recipient_id, actor_id, type, pod_id)
    select user_id, new.user_id, 'POD_UPDATED', new.id
    from pod_joins
    where pod_id = new.id and status = 'ACCEPTED';
    return new;
end;
$$;

create trigger pods_notify_update
    after update on pods
    for each row
    when (
        new.status = old.status and (
            new.game_key is distinct from old.game_key or
            new.format_key is distinct from old.format_key or
            new.playstyle_key is distinct from old.playstyle_key or
            new.power_tiers is distinct from old.power_tiers or
            new.type is distinct from old.type or
            new.location_name is distinct from old.location_name or
            new.scheduled_at is distinct from old.scheduled_at or
            new.max_players is distinct from old.max_players or
            new.notes is distinct from old.notes
        )
    )
    execute function public.notify_on_pod_update();

-- Realtime -------------------------------------------------------------

alter publication supabase_realtime add table pods;
alter publication supabase_realtime add table pod_joins;
alter publication supabase_realtime add table notifications;
