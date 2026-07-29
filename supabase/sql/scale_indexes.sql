-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Purely additive indexes supporting query patterns that are already run
-- constantly by the client (MatchFeed's active-pods query, MatchedPodWatcher's
-- poll, LfgButton's own-pod/own-join lookups), so their cost grows with
-- table size instead of staying flat as pods/pod_joins accumulate more
-- concurrently-active rows. No data or behavior changes — every query these
-- support already runs today, this just gives the planner an index to use.

-- Match Feed's primary filtered query: status = 'ACTIVE' plus equality
-- filters on game/format (src/lib/pods/matchFeed.ts). The trailing
-- playstyle_key column of the index this replaced was dead weight — the
-- feed stopped filtering on playstyle_key a while back — so this is a
-- straight swap to a smaller three-column index with the same coverage for
-- the query patterns that actually run today.
drop index if exists idx_pods_status_game_format_playstyle;
create index if not exists idx_pods_status_game_format
  on pods(status, game_key, format_key);

-- Match Feed's IRL/ONLINE + city scoping (status = 'ACTIVE' plus type,
-- and city for IRL pods).
create index if not exists idx_pods_status_type_city
  on pods(status, type, city);

-- Every feed/own-pod/joined-pods query pairs status = 'ACTIVE' with
-- `.gt("expires_at", now)` (src/lib/pods/matchFeed.ts, ownPod.ts) — neither
-- index above covers the range column, so give the planner one that does.
-- Equality column first, then the range column, per standard composite
-- index ordering.
create index if not exists idx_pods_status_expires_at
  on pods(status, expires_at);

-- MatchedPodWatcher's poll and LfgButton's "does this user have a
-- pending/accepted join" lookup both filter pod_joins by user_id + status
-- directly. The existing unique_user_pod (pod_id, user_id) index doesn't
-- serve user_id-only lookups efficiently since pod_id is the leading column.
create index if not exists idx_pod_joins_user_status
  on pod_joins(user_id, status);

-- pod_history's SELECT RLS policy and get_games_played_count() (see
-- pod_history.sql) both filter on host_id = auth.uid() with no supporting
-- index today.
create index if not exists idx_pod_history_host_id
  on pod_history(host_id);
