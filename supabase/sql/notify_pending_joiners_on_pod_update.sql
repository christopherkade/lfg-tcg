-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- IMPORTANT: run the "1." statement below on its own first (select it and
-- execute, or just run the whole script twice) — Postgres does not allow a
-- new enum value to be referenced in the same transaction that added it,
-- and the SQL editor sends a pasted script as a single transaction.
--
-- Today notify_on_pod_update only notifies ACCEPTED members when the host
-- edits an already-live pod's details (updatePod, src/app/actions/pods.ts).
-- Someone with a still-PENDING join request on that pod gets nothing, even
-- though the change (new scheduled time, fewer max players, different
-- format, etc.) can directly affect whether they still want to join. This
-- adds a new POD_UPDATED_PENDING notification, sent to every PENDING
-- requester — a distinct type rather than reusing POD_UPDATED because the
-- existing copy ("...a pod you joined") asserts membership that a pending
-- requester doesn't have yet.
--
-- This is a separate trigger from the existing notify_on_pod_update rather
-- than a rewrite of it, since that function's current source isn't tracked
-- in this repo (see notify_pod_destroyed.sql's header for the same note).
-- The fire condition (old.status = 'ACTIVE' and new.status = 'ACTIVE', plus
-- at least one editable detail actually changed) mirrors updatePod, which
-- only ever updates an ACTIVE pod's detail columns and never touches
-- `status` — cancelPod (-> EXPIRED) and markPodMatched (-> MATCHED) are
-- excluded by the status check, and a no-op save (host resubmits identical
-- values) is excluded by the IS DISTINCT FROM check.

-- 1. Extend the enum.
alter type notification_type add value if not exists 'POD_UPDATED_PENDING';

-- 2. Trigger function: fan out to every PENDING requester when a live
--    pod's details change.
create or replace function notify_pending_joiners_on_pod_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'ACTIVE' and new.status = 'ACTIVE' and (
    old.game_key is distinct from new.game_key
    or old.format_key is distinct from new.format_key
    or old.playstyle_key is distinct from new.playstyle_key
    or old.power_tiers is distinct from new.power_tiers
    or old.type is distinct from new.type
    or old.location_name is distinct from new.location_name
    or old.city is distinct from new.city
    or old.scheduled_at is distinct from new.scheduled_at
    or old.max_players is distinct from new.max_players
    or old.notes is distinct from new.notes
  ) then
    insert into notifications (recipient_id, actor_id, type, pod_id)
    select pod_joins.user_id, new.user_id, 'POD_UPDATED_PENDING', new.id
    from pod_joins
    where pod_joins.pod_id = new.id
      and pod_joins.status = 'PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists notify_pending_joiners_on_pod_update_trigger on pods;
create trigger notify_pending_joiners_on_pod_update_trigger
  after update on pods
  for each row
  execute function notify_pending_joiners_on_pod_update();
