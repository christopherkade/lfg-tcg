-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Backs the Profile screen's "Pods Hosted"/"IRL Games"/"Online Games" stat
-- cards (Section 5's Screen 1), replacing the old Win Rate/Current Streak
-- placeholders with real numbers. Mirrors get_games_played_count()'s exact
-- criteria (supabase/sql/pod_history.sql) — every pod_history row where the
-- caller is host_id or appears in the members JSONB array, deliberately
-- ignoring hidden_by so hiding an entry from "Past Pods" doesn't shrink
-- these achievement-style lifetime counters. Returns all three numbers in
-- one row so the Profile page only needs one extra round trip, not three.

create or replace function get_profile_pod_stats()
returns table(pods_hosted integer, irl_count integer, online_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where host_id = auth.uid())::integer as pods_hosted,
    count(*) filter (where type = 'IRL')::integer as irl_count,
    count(*) filter (where type = 'ONLINE')::integer as online_count
  from pod_history
  where host_id = auth.uid()
     or exists (
       select 1 from jsonb_array_elements(members) as m
       where (m->>'id')::uuid = auth.uid()
     );
$$;

grant execute on function get_profile_pod_stats() to authenticated;
