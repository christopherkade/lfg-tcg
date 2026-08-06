-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds pods.locked_at, set/cleared by toggleLockPod in
-- src/app/actions/pods.ts. Lets a pod's host (an organizer, for a
-- recurring table's currently-spawned session) close off new join
-- requests without cancelling the pod outright, and reopen them later.
-- Purely a join-request gate: does not affect the ACTIVE/MATCHED/EXPIRED
-- status machine, the recurring-table expiry cron, or the pod_history
-- snapshot trigger.

alter table pods add column if not exists locked_at timestamp with time zone;
