-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes: respondToJoin (src/app/actions/joins.ts) updates pod_joins.status
-- filtered only by the row's id — neither the app code nor
-- pod_joins_update_host_only (schema.sql) ever checked that the row was
-- still PENDING before applying the accept/reject. A duplicate or retried
-- request (a host with two tabs/devices open, a slow click followed by a
-- second one before the button disables) could apply two different
-- decisions to the same row, and whichever UPDATE committed last won
-- silently — including an ACCEPTED landing after a REJECTED, with no error
-- surfaced to either caller. This is the DB-layer half of the fix (the
-- app-layer half adds .eq("status", "PENDING") to the same update); RLS
-- enforcing it too is defense in depth, consistent with every other
-- app-layer rule in joinRules.ts having a matching RLS policy.
--
-- Fix: require the targeted row to still be PENDING for the UPDATE to
-- apply at all. Once one decision commits, a second respondToJoin call on
-- the same row now matches 0 rows (surfaced by the app as
-- errors.joinRequestNotFound) instead of overwriting the first decision.
--
-- Patches supabase/schema.sql (order 1, already applied to both prod and
-- staging), so this is a new one-off script rather than an edit to that
-- file, mirroring fix_pod_joins_delete_host.sql.
drop policy if exists "pod_joins_update_host_only" on pod_joins;

create policy "pod_joins_update_host_only" on pod_joins
    for update to authenticated using (
        pod_joins.status = 'PENDING'
        and exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from pods
            where pods.id = pod_joins.pod_id
            and pods.user_id = auth.uid()
        )
    );
