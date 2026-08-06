-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes: an organiser cancelling a recurring table's spawned pod ahead of
-- its start time (e.g. cancel on Monday for a Wednesday table) only
-- "cancelled" it for up to an hour. cancelPod (src/app/actions/pods.ts)
-- just flips the pod's status to EXPIRED; it never touches recurring_tables
-- or deletes the row. next_recurring_occurrence() has no concept of a
-- cancellation, so it keeps returning the same upcoming occurrence, and the
-- old pods_one_active_per_recurring_occurrence index only blocked a second
-- *ACTIVE* row for that (recurring_table_id, scheduled_at) pair — once the
-- row is EXPIRED it falls outside that partial index, so
-- spawn_due_recurring_pods()'s next hourly run silently re-inserts a brand
-- new pod (new id, zero pod_joins) for the exact occurrence the organiser
-- just cancelled, dropping anyone who had already joined.
--
-- Fix: broaden the uniqueness guarantee from "one ACTIVE pod per occurrence"
-- to "one pod per occurrence, ever, regardless of status." This makes a
-- cancel permanent for that specific week with zero app-code changes —
-- spawn_due_recurring_pods()'s `on conflict do nothing` has no explicit
-- conflict target, so it transparently picks up whichever unique index
-- exists. Natural weekly rollover is unaffected: each week has a distinct
-- scheduled_at, so this only ever blocks a re-attempt at the exact occurrence
-- already handled, never next week's.
--
-- Patches supabase/sql/recurring_tables.sql (order 17, already applied to
-- both prod and staging), so this is a new one-off script rather than an
-- edit to that file, mirroring remove_recurring_table_pause.sql/
-- fix_recurring_table_timezone.sql.
--
-- 0. Dedupe pre-existing duplicates *before* creating the new index below.
-- The bug this script fixes already produced real duplicate
-- (recurring_table_id, scheduled_at) rows in prod/staging data — the new
-- index can't be created until those are resolved (CREATE UNIQUE INDEX
-- fails with a 23505 duplicate-key error otherwise). For each occurrence
-- with more than one pod row, keep the currently-ACTIVE one if there is one
-- (that's the live, joinable session players actually see today); otherwise
-- keep the most recently created row. Deleting the rest cascade-deletes
-- their pod_joins/notifications — the same thing this project's existing
-- 24h EXPIRED-pod sweep (sql/matched_pod_cleanup.sql) already does
-- routinely to old duplicates-of-one; pod_history is untouched (a separate
-- table, already snapshotted at the ACTIVE -> EXPIRED transition via
-- snapshot_recurring_pod_history, independent of the pods row's later
-- deletion), so no organiser table history is lost.
with ranked as (
  select
    id,
    row_number() over (
      partition by recurring_table_id, scheduled_at
      order by (status = 'ACTIVE') desc, created_at desc
    ) as rn
  from pods
  where recurring_table_id is not null
)
delete from pods
where id in (select id from ranked where rn > 1);

drop index if exists pods_one_active_per_recurring_occurrence;

create unique index pods_one_per_recurring_occurrence on pods(recurring_table_id, scheduled_at)
  where recurring_table_id is not null;
