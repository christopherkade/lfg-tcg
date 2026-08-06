-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes: a rejected join request (`pod_joins.status = 'REJECTED'`) used to
-- sit around until the requester manually clicked "Dismiss" (leavePod,
-- src/app/actions/joins.ts) to clear it. Until they did, their own client
-- kept a `pod_joins` row for that pod, which is what made "Request to
-- Join" unavailable again (the unique (pod_id, user_id) constraint blocks
-- a fresh insert while any row — PENDING/ACCEPTED/REJECTED — still
-- exists) even though the request had already been fully processed.
--
-- Fix: as soon as respondToJoin transitions a row PENDING -> REJECTED,
-- a trigger deletes it immediately server-side — same end state as the
-- requester clicking Dismiss themselves, just automatic. This mirrors the
-- SECURITY DEFINER trigger convention every other pod_joins side effect in
-- this schema already follows (see notify_on_pod_join_insert/update/delete,
-- schema.sql), so it needs no RLS grant: the host doesn't get delete
-- access to a requester's row, the trigger just runs with the row-owning
-- function's own privileges.
--
-- Notification ordering is unaffected: pod_joins_notify_update (schema.sql)
-- is a separate AFTER UPDATE trigger on the same event and already fires
-- off the RETURNING/trigger-queue row image before this trigger's nested
-- DELETE runs, so JOIN_REJECTED still reaches the requester's
-- NotificationBell as before. The nested DELETE also can't trigger a
-- spurious MEMBER_LEFT: pod_joins_notify_delete only fires `when
-- (old.status = 'ACCEPTED')`, and by the time this trigger's DELETE runs
-- the row's status is already 'REJECTED'.
--
-- Patches supabase/schema.sql (order 1, already applied to both prod and
-- staging), so this is a new one-off script rather than an edit to that
-- file, mirroring fix_pod_joins_respond_pending_only.sql.
create or replace function public.auto_delete_rejected_pod_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from pod_joins where id = new.id;
    return null;
end;
$$;

drop trigger if exists pod_joins_auto_delete_rejected on pod_joins;

create trigger pod_joins_auto_delete_rejected
    after update on pod_joins
    for each row
    when (old.status = 'PENDING' and new.status = 'REJECTED')
    execute function public.auto_delete_rejected_pod_join();
