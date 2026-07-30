-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Backs the "platform activity" trust signal shown on the Login screen and
-- on the Match Feed's empty state (PlatformActivityTicker component) — a
-- lightweight, honest "is this thing alive" indicator sourced entirely from
-- data the app already collects (pods, pod_history), with no seeded/fake
-- data. See SPECS.md Section 3/5/6.
--
-- IMPORTANT: unlike every other RPC in this project (get_profile_pod_stats,
-- get_games_played_count, hide_pod_history_entry — all `authenticated`-only,
-- matching the "RLS is `to authenticated` only, no anon access anywhere"
-- invariant elsewhere in this schema), both functions below are also
-- granted to `anon`. This is a deliberate, narrow exception: the Login page
-- has no session, so the anon Postgres role is the only way to serve a
-- pre-auth activity signal there. It's safe specifically because each
-- function's own `select` list is the entire attack surface — SECURITY
-- DEFINER bypasses RLS, but only a handful of non-identifying columns are
-- ever returned, never user_id/host_id/username/city/location_name/notes/
-- members. That's a materially smaller surface than opening an anon SELECT
-- policy on `pods`/`pod_history` directly. No rate-limiting is added here
-- (supabase/sql/rate_limits.sql covers mutations, not this read); the
-- p_limit clamp in get_recent_platform_activity is the only abuse guard.

-- 1. Aggregate counts. matched_last_24h/matched_last_7d deliberately ignore
--    pod_history.hidden_by — same "aggregate/lifetime counters shouldn't
--    shrink from a personal declutter action" convention documented on
--    get_games_played_count() (pod_history.sql). active_pod_count
--    deliberately doesn't need a "pods created in the last 24h" sibling:
--    inactive_pod_cleanup.sql/matched_pod_cleanup.sql sweep the live `pods`
--    table on windows that don't align with created_at, so a created-in-24h
--    count sourced from `pods` would silently under-report anything that
--    fizzled out and got swept in between. pod_history-backed counts don't
--    have that problem — that table is durable and never swept.
create or replace function get_platform_activity_stats()
returns table(
  active_pod_count integer,
  matched_last_24h integer,
  matched_last_7d integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::integer from pods
       where status = 'ACTIVE' and expires_at > now()) as active_pod_count,
    (select count(*)::integer from pod_history
       where matched_at > now() - interval '24 hours') as matched_last_24h,
    (select count(*)::integer from pod_history
       where matched_at > now() - interval '7 days') as matched_last_7d;
$$;

grant execute on function get_platform_activity_stats() to authenticated, anon;

-- 2. A small recent-events list for the ticker's rotating line. Returns
--    only game_key/format_key/type/event_type/event_at — structurally no
--    PII, enforced by this select list rather than by RLS, so a future
--    column added to pods/pod_history can't leak through it silently.
--    CREATED events read the live `pods` table with no status filter
--    (ACTIVE, MATCHED, and not-yet-swept EXPIRED rows all count as "someone
--    genuinely searched") — fine here because this is a small, recency-
--    biased list, not a correctness-sensitive aggregate like the counts
--    above. MATCHED events read pod_history.matched_at, again ignoring
--    hidden_by per that table's aggregate convention.
create or replace function get_recent_platform_activity(p_limit integer default 6)
returns table(
  event_type text,
  game_key text,
  format_key text,
  type match_type,
  event_at timestamp with time zone
)
language sql
security definer
set search_path = public
stable
as $$
  with capped as (
    -- Clamp: this is anon-callable, don't let a caller ask for an
    -- unbounded union via a huge p_limit.
    select greatest(1, least(coalesce(p_limit, 6), 20)) as n
  )
  select event_type, game_key, format_key, type, event_at
  from (
    select 'CREATED' as event_type, game_key, format_key, type, created_at as event_at
    from pods
    order by created_at desc
    limit (select n from capped)
  ) recent_created
  union all
  select event_type, game_key, format_key, type, event_at
  from (
    select 'MATCHED' as event_type, game_key, format_key, type, matched_at as event_at
    from pod_history
    order by matched_at desc
    limit (select n from capped)
  ) recent_matched
  order by event_at desc
  limit (select n from capped);
$$;

grant execute on function get_recent_platform_activity(integer) to authenticated, anon;

-- 3. Supporting indexes for the ordering above — neither exists today
--    (idx_pods_status_expires_at from scale_indexes.sql covers the
--    aggregate count's predicate, but not this descending created_at scan).
create index if not exists idx_pods_created_at on pods(created_at desc);
create index if not exists idx_pod_history_matched_at on pod_history(matched_at desc);
