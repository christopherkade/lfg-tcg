-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Fixes the recurring-table timezone bug: next_recurring_occurrence()/
-- spawn_due_recurring_pods() explicitly treated recurring_tables.start_time/
-- end_time (naive wall-clock `time`, no offset) as UTC. For an organiser in
-- any zone other than UTC, this shifted every spawned pod's scheduled_at/
-- expires_at away from the time they actually picked (e.g. 11:00 Europe/
-- Paris in summer, UTC+2, was stored/read back as 13:00 for viewers).
--
-- Fix: recurring_tables now carries its own IANA timezone (captured
-- silently from the organiser's browser at save time — see
-- src/lib/organizer/validateRecurringTable.ts), and the two functions below
-- convert wall-clock start_time/end_time using that column instead of a
-- hardcoded 'UTC', DST-aware via Postgres's zoneinfo database.
--
-- Patches supabase/sql/recurring_tables.sql (order 17) and
-- supabase/sql/remove_recurring_table_pause.sql (order 20) — both already
-- applied (see supabase/MANIFEST.md), so this is a new one-off script
-- rather than an edit to either. Depends on order 20 already being applied
-- (assumes spawn_due_recurring_pods()'s is_active-free loop).

-- 1. New column. Existing rows default to 'Europe/Paris' — the overwhelming
-- majority case (see CITIES_CONFIG), though it does include a handful of
-- overseas-territory zones. An organiser outside metropolitan France will
-- need to open and re-save their existing table once after this ships to
-- pick up their real zone automatically (no UI change needed on their end).
alter table recurring_tables add column if not exists timezone text not null default 'Europe/Paris';

-- 2. next_recurring_occurrence() gains a _timezone param — signature change,
-- so the old (smallint, time) overload must be dropped explicitly before
-- recreating (create or replace can't change a function's argument list).
drop function if exists next_recurring_occurrence(smallint, time);

create or replace function public.next_recurring_occurrence(
  _day_of_week smallint,
  _start_time time,
  _timezone text
) returns timestamptz
language plpgsql
stable
as $$
declare
  v_local_now timestamp;
  v_days_ahead int;
  v_candidate timestamptz;
begin
  -- extract(dow from ...) returns 0=Sunday..6=Saturday, same convention as
  -- JS Date#getDay() — matches day_of_week's stored meaning 1:1.
  v_local_now := now() at time zone _timezone;
  v_days_ahead := (_day_of_week - extract(dow from v_local_now)::int + 7) % 7;
  v_candidate := (date_trunc('day', v_local_now) + (v_days_ahead || ' days')::interval + _start_time) at time zone _timezone;

  if v_candidate < now() then
    v_candidate := v_candidate + interval '7 days';
  end if;

  return v_candidate;
end;
$$;

-- 3. spawn_due_recurring_pods() — same shape as order 20's version, now
-- passing/using rt.timezone instead of a hardcoded 'UTC'.
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
    v_scheduled_at := public.next_recurring_occurrence(rt.day_of_week, rt.start_time, rt.timezone);

    -- Same wall-clock arithmetic as next_recurring_occurrence, anchored to
    -- the occurrence's own date instead of "today", now in the table's own
    -- zone. <= start_time means the event spans midnight (e.g. 22:00 ->
    -- 01:00), so roll to the next calendar day.
    v_ends_at := (date_trunc('day', v_scheduled_at at time zone rt.timezone) + rt.end_time) at time zone rt.timezone;
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
