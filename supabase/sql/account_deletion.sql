-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds account deletion: today Sign Out is the only account action on the
-- Profile screen, with no way to actually remove your data. profiles.id
-- references auth.users on delete cascade, and pods/pod_joins/notifications
-- (as recipient)/pod_history (as host_id) all cascade off profiles(id), so
-- deleting the auth.users row already tears down almost everything
-- correctly on its own (see SPECS.md Section 3's FK chain). The one thing
-- that DOESN'T cascade is pod_history.members — a denormalized jsonb
-- snapshot of {id, username, discord_handle, avatar_url}, not FK'd to
-- profiles — so a deleted user's old identity would otherwise linger
-- forever inside other people's Past Pods history. This RPC anonymizes
-- those entries before deleting the auth.users row.
--
-- Exposed as a SECURITY DEFINER RPC (mirroring hide_pod_history_entry's
-- existing convention) rather than a plain client delete, since deleting
-- from auth.users isn't something the anon/authenticated role can do
-- directly, and this project has no service-role client set up anywhere.

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Anonymize this user's entries inside OTHER people's pod_history rows
  -- (rows this user hosted are deleted outright by the cascade below, so
  -- only non-hosted rows containing them in `members` need scrubbing).
  update pod_history
  set members = (
    select coalesce(jsonb_agg(
      case
        when (elem->>'id')::uuid = v_uid then
          elem || jsonb_build_object(
            'username', 'Deleted User',
            'discord_handle', '',
            'avatar_url', null
          )
        else elem
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(members) as elem
  )
  where host_id != v_uid
    and exists (
      select 1 from jsonb_array_elements(members) as m
      where (m->>'id')::uuid = v_uid
    );

  -- Cascades through profiles -> pods, pod_joins, notifications
  -- (recipient_id; actor_id sets NULL instead), pod_history (host_id).
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function delete_own_account() to authenticated;
