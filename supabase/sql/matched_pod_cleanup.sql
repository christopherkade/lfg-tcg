-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds pods.matched_at (set by markPodMatched in src/app/actions/pods.ts
-- whenever a pod transitions to MATCHED) and schedules an hourly pg_cron
-- job that permanently deletes pods 24h after they've served their
-- purpose:
--   - MATCHED pods: kept 24h after matched_at so MatchedPodWatcher's
--     poll/realtime fallback (10s interval while a tab is visible, plus
--     focus/visibility triggers) has ample time to surface the
--     MatchedDialog to every accepted member before the row (and its
--     pod_joins, via ON DELETE CASCADE) disappears.
--   - EXPIRED pods: kept 24h past expires_at, closing the "no automated
--     expiry sweep" gap noted in docs/specs/08-scope-exclusions.md.
--
-- Deleting a pod cascades (per the schema) to its pod_joins and
-- notifications rows, so both statuses get the same grace window.

-- 1. Track when a pod was marked MATCHED.
alter table pods add column if not exists matched_at timestamp with time zone;

-- 2. Enable pg_cron (no-op if already enabled).
create extension if not exists pg_cron with schema extensions;

-- 3. Schedule the hourly sweep. Re-running this script updates the job
--    definition (unschedule + reschedule) rather than erroring on a
--    duplicate job name.
select cron.unschedule(jobid)
from cron.job
where jobname = 'sweep-matched-expired-pods';

select cron.schedule(
  'sweep-matched-expired-pods',
  '0 * * * *', -- top of every hour
  $$
  delete from pods
  where (status = 'MATCHED' and matched_at is not null and matched_at < now() - interval '24 hours')
     or (status = 'EXPIRED' and expires_at < now() - interval '24 hours');
  $$
);
