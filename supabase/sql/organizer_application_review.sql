-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- IMPORTANT: run section "1. Extend the enum" on its own first (select just
-- those two statements and execute, or just run the whole script twice) —
-- Postgres does not allow a new enum value to be referenced in the same
-- transaction that added it, and the SQL editor sends a pasted script as a
-- single transaction. Same requirement as inactive_pod_cleanup.sql.
--
-- Replaces organizer onboarding's "unlisted URL is the only gate" model
-- (recurring_tables.sql, docs/specs/03-schema.md) with a real admin-review
-- step: /organizer/apply now inserts into organizer_applications (pending),
-- and only an admin accepting an application inserts the organizers row.
-- See src/app/actions/organizer.ts and the new src/app/actions/admin.ts.

-- ============================================================
-- 1. Extend the enum. RUN THIS STATEMENT FIRST, ALONE.
-- ============================================================
alter type notification_type add value if not exists 'ORGANIZER_APPLICATION_APPROVED';
alter type notification_type add value if not exists 'ORGANIZER_APPLICATION_REJECTED';

-- ============================================================
-- 2. Admin flag on profiles.
--
-- A plain boolean rather than a separate roles table — there is exactly one
-- admin surface today (this one) and this mirrors organizers.is_active as
-- the simplest thing that works. Flip it manually per-admin; no UI for this
-- on purpose (granting admin is rare and deliberately out of band).
-- ============================================================
alter table profiles add column if not exists is_admin boolean not null default false;

-- One-time grant for the site owner. Re-running this is harmless (idempotent
-- update), but it's data, not schema — only needs to run once per environment.
update profiles set is_admin = true where discord_handle = 'counterspell_fr';

-- Closes the gap this whole script exists to close: organizers_insert_self
-- (recurring_tables.sql) still lets any authenticated user insert their own
-- `organizers` row directly (id = auth.uid()), completely bypassing the new
-- pending-application review below. `organizers` rows are now only ever
-- created by approve_organizer_application (SECURITY DEFINER, section 4),
-- which doesn't need a client-facing insert policy to do so.
drop policy if exists "organizers_insert_self" on organizers;

-- ============================================================
-- 3. organizer_applications — pending review queue.
--
-- Separate from `organizers` (recurring_tables.sql) so that table only ever
-- contains approved organizers. A rejected applicant can re-apply (a fresh
-- row); the partial unique index below only blocks a second concurrently
-- *pending* application per user.
-- ============================================================
create type application_status as enum ('pending', 'approved', 'rejected');

create table organizer_applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  store_name text not null check (length(store_name) between 1 and 80),
  city text not null,
  description text check (description is null or length(description) <= 500),
  verification_url text not null check (length(verification_url) between 1 and 500),
  email text not null check (length(email) between 1 and 320),
  status application_status not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create unique index organizer_applications_one_pending_per_user
  on organizer_applications(user_id) where status = 'pending';

create index organizer_applications_status_idx on organizer_applications(status, created_at desc);

alter table organizer_applications enable row level security;

create policy "organizer_applications_select_own_or_admin" on organizer_applications
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

create policy "organizer_applications_insert_own" on organizer_applications
  for insert to authenticated with check (
    user_id = auth.uid() and status = 'pending'
  );

-- No authenticated update policy: status transitions only happen through
-- the SECURITY DEFINER functions below (same reasoning as `notifications`
-- having no client-facing insert policy) — an applicant can never
-- self-approve, and an admin's UI goes through the RPCs, not a raw update.

-- ============================================================
-- 4. Review actions — SECURITY DEFINER so they can both bypass
-- organizer_applications' lack of an update policy and insert into
-- `organizers`/`notifications` (neither has an authenticated insert policy
-- for this either), while still enforcing the admin check themselves.
-- ============================================================
create or replace function public.approve_organizer_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _app organizer_applications%rowtype;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  select * into _app from organizer_applications where id = p_application_id and status = 'pending';
  if not found then
    raise exception 'application not found or already reviewed';
  end if;

  update organizer_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = _app.id;

  insert into organizers (id, store_name, city, description, verification_url)
  values (_app.user_id, _app.store_name, _app.city, _app.description, _app.verification_url)
  on conflict (id) do update set
    store_name = excluded.store_name,
    city = excluded.city,
    description = excluded.description,
    verification_url = excluded.verification_url,
    is_active = true,
    updated_at = now();

  insert into notifications (recipient_id, actor_id, type)
  values (_app.user_id, auth.uid(), 'ORGANIZER_APPLICATION_APPROVED');
end;
$$;

grant execute on function public.approve_organizer_application(uuid) to authenticated;

create or replace function public.reject_organizer_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _app organizer_applications%rowtype;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  select * into _app from organizer_applications where id = p_application_id and status = 'pending';
  if not found then
    raise exception 'application not found or already reviewed';
  end if;

  update organizer_applications
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = _app.id;

  insert into notifications (recipient_id, actor_id, type)
  values (_app.user_id, auth.uid(), 'ORGANIZER_APPLICATION_REJECTED');
end;
$$;

grant execute on function public.reject_organizer_application(uuid) to authenticated;
