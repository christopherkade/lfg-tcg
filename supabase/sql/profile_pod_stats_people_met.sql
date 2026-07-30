-- Patches get_profile_pod_stats() (supabase/sql/profile_pod_stats.sql, order 12):
-- replaces pods_hosted with people_met — the count of distinct people
-- (by profiles.id, not discord_handle, since handles can be renamed) the
-- caller has shared a matched pod with, host or member, across every
-- pod_history row they appear in. Same host-or-member/hidden_by-ignoring
-- criteria as before.
--
-- The RETURNS TABLE column set is changing (pods_hosted -> people_met), and
-- Postgres refuses to CREATE OR REPLACE a function across a different OUT
-- parameter list (42P13: cannot change return type of existing function) —
-- so the old function must be dropped first.

drop function if exists get_profile_pod_stats();

create function get_profile_pod_stats()
returns table(people_met integer, irl_count integer, online_count integer)
language sql
security definer
set search_path = public
stable
as $$
  with my_pods as (
    select host_id, members, type
    from pod_history
    where host_id = auth.uid()
       or exists (
         select 1 from jsonb_array_elements(members) as m
         where (m->>'id')::uuid = auth.uid()
       )
  ),
  people as (
    select host_id as person_id from my_pods where host_id <> auth.uid()
    union
    select (m->>'id')::uuid as person_id
    from my_pods, jsonb_array_elements(members) as m
    where (m->>'id')::uuid <> auth.uid()
  )
  select
    (select count(distinct person_id) from people)::integer as people_met,
    (select count(*) from my_pods where type = 'IRL')::integer as irl_count,
    (select count(*) from my_pods where type = 'ONLINE')::integer as online_count;
$$;

grant execute on function get_profile_pod_stats() to authenticated;
