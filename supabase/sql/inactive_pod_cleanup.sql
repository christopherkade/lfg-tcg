-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- IMPORTANT: run the "1." statement below on its own first (select it and
-- execute, or just run the whole script twice) — Postgres does not allow a
-- new enum value to be referenced in the same transaction that added it,
-- and the SQL editor sends a pasted script as a single transaction.
--
-- Closes a different gap than matched_pod_cleanup.sql: a pod that never
-- gets a join request (or a match) just sits ACTIVE forever — nothing ever
-- flips it to EXPIRED, so it's invisible to the existing sweep. This adds a
-- second hourly pg_cron job that hard-deletes any ACTIVE pod whose
-- created_at is more than 12 hours old, notifying the host and any
-- ACCEPTED members first.
--
-- Notifications are inserted with pod_id = NULL rather than the doomed
-- pod's id — notifications.pod_id is ON DELETE CASCADE (see
-- notify_pod_destroyed.sql / SPECS.md Section 3), so inserting with the
-- real pod_id inside the same statement that deletes the pod would have
-- the DELETE cascade the just-inserted row away again. NotificationBell
-- doesn't need pod_id anyway — every notification type navigates to
-- /pods on click regardless.

-- 1. Extend the enum.
alter type notification_type add value if not exists 'POD_EXPIRED_INACTIVITY';

-- 2. Enable pg_cron (no-op if already enabled).
create extension if not exists pg_cron with schema extensions;

-- 3. Schedule the hourly sweep. Re-running this script updates the job
--    definition (unschedule + reschedule) rather than erroring on a
--    duplicate job name.
select cron.unschedule(jobid)
from cron.job
where jobname = 'sweep-inactive-active-pods';

select cron.schedule(
  'sweep-inactive-active-pods',
  '0 * * * *', -- top of every hour
  $$
  with inactive as (
    select id, user_id
    from pods
    where status = 'ACTIVE'
      and created_at < now() - interval '12 hours'
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
