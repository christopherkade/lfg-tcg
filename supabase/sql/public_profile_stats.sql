-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Patches get_profile_pod_stats() (order 12/14) and get_games_played_count()
-- (order 9) to accept an optional p_user_id, defaulting to auth.uid() so
-- every existing zero-arg call (Profile screen, History screen) keeps
-- working unchanged. This is what lets the public profile side panel
-- (/profile/[username]) show another user's stats.
--
-- Both functions are dropped first, not just CREATE OR REPLACEd: adding a
-- parameter is a new signature, and CREATE OR REPLACE can't retarget an
-- existing zero-arg function to a new arg list — it would silently create a
-- second overload instead, leaving the old zero-arg one live alongside it.
--
-- This script fully supersedes sql/profile_pod_stats_people_met.sql (order
-- 14, same people_met/irl_count/online_count body) — if that one hasn't
-- been applied yet, skip it and apply this one instead.

drop function if exists get_profile_pod_stats();
drop function if exists get_games_played_count();

create or replace function get_profile_pod_stats(p_user_id uuid default auth.uid())
returns table(people_met integer, irl_count integer, online_count integer)
language sql
security definer
set search_path = public
stable
as $$
  with my_pods as (
    select host_id, members, type
    from pod_history
    where host_id = p_user_id
       or exists (
         select 1 from jsonb_array_elements(members) as m
         where (m->>'id')::uuid = p_user_id
       )
  ),
  people as (
    select host_id as person_id from my_pods where host_id <> p_user_id
    union
    select (m->>'id')::uuid as person_id
    from my_pods, jsonb_array_elements(members) as m
    where (m->>'id')::uuid <> p_user_id
  )
  select
    (select count(distinct person_id) from people)::integer as people_met,
    (select count(*) from my_pods where type = 'IRL')::integer as irl_count,
    (select count(*) from my_pods where type = 'ONLINE')::integer as online_count;
$$;

create or replace function get_games_played_count(p_user_id uuid default auth.uid())
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from pod_history
  where host_id = p_user_id
     or exists (
       select 1 from jsonb_array_elements(members) as m
       where (m->>'id')::uuid = p_user_id
     );
$$;

grant execute on function get_profile_pod_stats(uuid) to authenticated;
grant execute on function get_games_played_count(uuid) to authenticated;
