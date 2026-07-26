-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes MatchedDialog surfacing on first login on a new device. Previously,
-- MatchedPodWatcher tracked "has this user already been shown the dialog for
-- this pod" purely in localStorage, keyed per-browser. A new device (or
-- cleared storage) starts with an empty set, and the on-mount poll has no
-- time bound — it just checks "am I ACCEPTED on a pod that is currently
-- MATCHED" — so any pod matched at any point in the past looks brand new
-- and re-triggers the dialog. This adds a durable, server-side flag instead.

-- 1. Column: when the MATCHED notification has been shown to this joiner.
--    NULL means "not yet shown". Only meaningful for rows where the pod
--    has actually transitioned to MATCHED; irrelevant otherwise.
alter table pod_joins add column if not exists matched_notified_at timestamptz;

-- 2. RPC: lets a joiner mark their own row as notified without a
--    client-facing UPDATE policy (today's UPDATE policy on pod_joins is
--    host-only, for Accept/Reject). Callable via
--    `supabase.rpc("mark_matched_notification_seen", { p_pod_join_id })`.
--    No-ops if the row doesn't belong to the caller or was already marked.
create or replace function mark_matched_notification_seen(p_pod_join_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pod_joins
  set matched_notified_at = now()
  where id = p_pod_join_id
    and user_id = auth.uid()
    and matched_notified_at is null;
end;
$$;

grant execute on function mark_matched_notification_seen(uuid) to authenticated;
