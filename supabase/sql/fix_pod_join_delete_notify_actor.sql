-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes: "insert or update on table notifications violates foreign key
-- constraint notifications_actor_id_fkey" when a user deletes their own
-- account (delete_own_account, account_deletion.sql) while they're an
-- ACCEPTED member of someone else's still-active pod.
--
-- Root cause: deleting auth.users cascades profiles -> pod_joins for the
-- deleted user's own join rows. The AFTER DELETE trigger below
-- (notify_on_pod_join_delete) then tries to notify the host with
-- actor_id = old.user_id — but that user's profiles row is already gone by
-- the time this fires, so the fresh INSERT's actor_id FK has nothing to
-- point to. notifications.actor_id is ON DELETE SET NULL, but that clause
-- only rewrites EXISTING rows when their target disappears; it can't
-- rescue a brand-new INSERT referencing an id that's already gone.
--
-- Fix: look up the acting user's profile before inserting, and fall back to
-- a null actor_id (same as the FK's own ON DELETE SET NULL semantics) when
-- it no longer exists, instead of assuming old.user_id is still valid.

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
