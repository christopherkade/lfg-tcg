-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes: a pod host clicking "Remove" on an accepted member (MyPodPanel,
-- and OrganizerRecurringTableCard's join-request management) silently does
-- nothing — no error, the member just never disappears.
--
-- Root cause: pod_joins has exactly one DELETE policy,
-- pod_joins_delete_own (schema.sql), scoped to `user_id = auth.uid()` —
-- it only ever let a joiner delete their OWN row (cancel a PENDING
-- request, or leave after being ACCEPTED). removeMember
-- (src/app/actions/joins.ts) already checks host ownership at the app
-- level (canRemoveMember, src/lib/pods/joinRules.ts) before attempting the
-- delete, but the actual `DELETE ... WHERE id = joinId` was then silently
-- filtered to 0 affected rows by RLS when the caller was the host, not the
-- joiner — Postgres doesn't raise an error for a DELETE that matches zero
-- rows, so the action returned success with nothing actually removed.
--
-- Fix: add a second, additive DELETE policy scoped to the host — Postgres
-- combines multiple permissive policies for the same operation with OR, so
-- this doesn't touch pod_joins_delete_own at all, just adds the missing
-- case. Mirrors the exact host-ownership subquery already used (and
-- already proven not to cause RLS recursion) by
-- pod_joins_select_own_or_host_or_accepted's own "the pod is owned by
-- auth.uid()" branch (schema.sql) — pods' own SELECT policy never queries
-- back into pod_joins via a plain subquery (its accepted-member check goes
-- through the SECURITY DEFINER is_accepted_pod_member instead), so this
-- doesn't create the pods<->pod_joins policy cycle documented in SPECS.md.
-- Scoped to status = 'ACCEPTED' to match canRemoveMember's own restriction
-- (a still-PENDING request is rejected via respondToJoin, not removed).
drop policy if exists "pod_joins_delete_by_host" on pod_joins;
create policy "pod_joins_delete_by_host" on pod_joins
  for delete to authenticated using (
    status = 'ACCEPTED'
    and exists (
      select 1 from pods
      where pods.id = pod_joins.pod_id
      and pods.user_id = auth.uid()
    )
  );
