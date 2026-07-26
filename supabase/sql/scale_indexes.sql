-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Purely additive indexes supporting query patterns that are already run
-- constantly by the client (MatchFeed's active-pods query, MatchedPodWatcher's
-- 10s poll, LfgButton's own-pod/own-join lookups), so their cost grows with
-- table size instead of staying flat as pods/pod_joins accumulate more
-- concurrently-active rows. No data or behavior changes — every query these
-- support already runs today, this just gives the planner an index to use.

-- Match Feed's primary filtered query: status = 'ACTIVE' plus equality
-- filters on game/format/playstyle (src/components/MatchFeed.tsx).
create index if not exists idx_pods_status_game_format_playstyle
  on pods(status, game_key, format_key, playstyle_key);

-- Match Feed's IRL/ONLINE + city scoping (status = 'ACTIVE' plus type,
-- and city for IRL pods).
create index if not exists idx_pods_status_type_city
  on pods(status, type, city);

-- MatchedPodWatcher's 10s poll and LfgButton's "does this user have a
-- pending/accepted join" lookup both filter pod_joins by user_id + status
-- directly. The existing unique_user_pod (pod_id, user_id) index doesn't
-- serve user_id-only lookups efficiently since pod_id is the leading column.
create index if not exists idx_pod_joins_user_status
  on pod_joins(user_id, status);
