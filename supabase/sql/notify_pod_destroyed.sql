-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- IMPORTANT: run the "1." statement below on its own first (select it and
-- execute, or just run the whole script twice) — Postgres does not allow a
-- new enum value to be referenced in the same transaction that added it,
-- and the SQL editor sends a pasted script as a single transaction.
--
-- Adds a POD_DESTROYED notification, sent to every ACCEPTED member of a pod
-- when the host cancels it (cancelPod, src/app/actions/pods.ts) or replaces
-- it with a new search (createPod's auto-expire-before-insert) — i.e. the
-- pod goes ACTIVE -> EXPIRED without ever reaching MATCHED. Members with a
-- still-PENDING request are not notified, matching the existing MEMBER_LEFT
-- convention (docs/specs/03-schema.md) where an unaccepted request is treated as
-- never having really joined the group.
--
-- This is a separate trigger from the existing notify_on_pod_update (which
-- fires POD_UPDATED on live-detail edits) rather than a rewrite of it, since
-- that function's current source isn't tracked in this repo.

-- 1. Extend the enum.
alter type notification_type add value if not exists 'POD_DESTROYED';

-- 2. Trigger function: fan out to every ACCEPTED member (not the host, who
--    is the one performing the cancel/replace) when a pod transitions
--    ACTIVE -> EXPIRED.
create or replace function notify_on_pod_destroyed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'ACTIVE' and new.status = 'EXPIRED' then
    insert into notifications (recipient_id, actor_id, type, pod_id)
    select pod_joins.user_id, new.user_id, 'POD_DESTROYED', new.id
    from pod_joins
    where pod_joins.pod_id = new.id
      and pod_joins.status = 'ACCEPTED';
  end if;
  return new;
end;
$$;

-- WHEN mirrors the function body's own `if` above so Postgres skips the
-- function call entirely on every pods UPDATE that isn't an ACTIVE -> EXPIRED
-- transition — matching the WHEN-clause convention already used by
-- schema.sql's own triggers (pod_joins_notify_update/delete,
-- pods_notify_update).
drop trigger if exists notify_on_pod_destroyed_trigger on pods;
create trigger notify_on_pod_destroyed_trigger
  after update on pods
  for each row
  when (old.status = 'ACTIVE' and new.status = 'EXPIRED')
  execute function notify_on_pod_destroyed();
