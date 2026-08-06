-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Removes the recurring-table "pause" feature (organizer.table.pause/
-- resume, setRecurringTableActive) — organisers now stop a table entirely
-- via delete (deleteRecurringTable) instead of pausing it; recreating the
-- table is the only way to bring it back. Distinct from the separate
-- pod-level "lock" feature (supabase/sql/pod_lock.sql), which is untouched.
--
-- Patches supabase/sql/recurring_tables.sql (order 17, already applied to
-- both prod and staging — see supabase/MANIFEST.md), so this is a new
-- one-off script rather than an edit to that file, mirroring how
-- recurring_tables.sql itself patched rate_limits.sql/schema.sql/
-- inactive_pod_cleanup.sql instead of editing those already-applied files.

-- 1. Drop the RLS policy that reads is_active before dropping the column —
-- Postgres refuses to drop a column a policy still references.
drop policy if exists "recurring_tables_select_active_or_own" on recurring_tables;

-- 2. Drop the pause switch itself.
alter table recurring_tables drop column if exists is_active;

-- 3. Replace with an unconditional SELECT policy — nothing in the app
-- distinguishes paused-vs-active tables anymore, so any authenticated user
-- can see any recurring table (an organiser could already always see their
-- own; this just extends that same visibility to every table, matching a
-- spawned pod's linked table already being visible to anyone).
create policy "recurring_tables_select_all" on recurring_tables
  for select to authenticated using (true);

-- 4. spawn_due_recurring_pods() — identical body to
-- supabase/sql/recurring_tables.sql, minus `where is_active = true`; a
-- recurring table now spawns unconditionally until its organiser deletes it.
create or replace function public.spawn_due_recurring_pods()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rt record;
  v_scheduled_at timestamptz;
  v_ends_at timestamptz;
begin
  for rt in select * from recurring_tables loop
    v_scheduled_at := public.next_recurring_occurrence(rt.day_of_week, rt.start_time);

    -- Same wall-clock-as-UTC arithmetic as next_recurring_occurrence, just
    -- anchored to the occurrence's own date instead of "today". <= start_time
    -- means the event spans midnight (e.g. 22:00 -> 01:00), so roll to the
    -- next calendar day.
    v_ends_at := (date_trunc('day', v_scheduled_at at time zone 'UTC') + rt.end_time) at time zone 'UTC';
    if rt.end_time <= rt.start_time then
      v_ends_at := v_ends_at + interval '1 day';
    end if;

    if v_scheduled_at <= now() + (rt.lead_time_hours || ' hours')::interval then
      insert into pods (
        user_id, game_key, format_key, playstyle_key, power_tiers, type,
        location_name, city, scheduled_at, expires_at, max_players, notes,
        recurring_table_id, auto_accept, store_name
      )
      values (
        rt.organizer_id, rt.game_key, rt.format_key, rt.playstyle_key, rt.power_tiers, rt.type,
        rt.location_name, rt.city, v_scheduled_at,
        v_ends_at, -- the occurrence's real end time, NOT a flat scheduled_at+4h guess (see docs/specs/03-schema.md rationale)
        rt.max_players, rt.notes, rt.id, rt.auto_accept, rt.store_name
      )
      on conflict do nothing; -- backstop; pods_one_active_per_recurring_occurrence is the hard guarantee
    end if;
  end loop;
end;
$$;
