-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- IMPORTANT: run section "1. Extend the enum" on its own first (select just
-- that statement and execute, or just run the whole script twice) —
-- Postgres does not allow a new enum value to be referenced in the same
-- transaction that added it, and the SQL editor sends a pasted script as a
-- single transaction. Same requirement as inactive_pod_cleanup.sql /
-- organizer_application_review.sql.
--
-- Patches organizer_application_review.sql (already applied): notifies the
-- applicant themselves the moment they submit an application, as a "we
-- received it" receipt — previously the only notifications on this table
-- were the admin's Accept/Refuse decision, so an applicant had zero
-- confirmation their submission actually went through.

-- ============================================================
-- 1. Extend the enum. RUN THIS STATEMENT FIRST, ALONE.
-- ============================================================
alter type notification_type add value if not exists 'ORGANIZER_APPLICATION_SUBMITTED';

-- ============================================================
-- 2. Notify on insert. Follows this schema's standing convention that
-- `notifications` rows are only ever created by SECURITY DEFINER triggers,
-- never application code (see notify_on_pod_join_insert et al. in
-- schema.sql) — organizer_applications has no authenticated INSERT policy
-- on `notifications` either, so applyAsOrganizer (src/app/actions/
-- organizer.ts), running under the applicant's own RLS-scoped client,
-- could not insert this notification directly even for themselves.
-- ============================================================
create or replace function public.notify_on_organizer_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, actor_id, type)
  values (new.user_id, new.user_id, 'ORGANIZER_APPLICATION_SUBMITTED');
  return new;
end;
$$;

drop trigger if exists organizer_applications_notify_insert on organizer_applications;

create trigger organizer_applications_notify_insert
  after insert on organizer_applications
  for each row execute function public.notify_on_organizer_application_insert();
