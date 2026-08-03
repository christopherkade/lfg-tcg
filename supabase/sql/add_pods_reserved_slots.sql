-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds pods.reserved_slots: the number of seats a host has already filled
-- with people outside the app (e.g. IRL friends), so the Match Feed can
-- reflect the pod's true remaining capacity without those seats having
-- real pod_joins rows. See createPod/updatePod in src/app/actions/pods.ts
-- and validateStartSearchInput in src/lib/pods/validateStartSearch.ts.
--
-- At least one seat besides the host must remain open for the pod to be
-- worth posting, hence the `<= max_players - 2` bound.

alter table pods
    add column if not exists reserved_slots int not null default 0
    check (reserved_slots >= 0 and reserved_slots <= max_players - 2);
