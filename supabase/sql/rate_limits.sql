-- Run this once in the Supabase SQL editor (Project > SQL Editor).
--
-- Adds abuse/spam guardrails: nothing today stops a user from
-- cancel+recreating pods instantly, or firing join requests at many pods
-- back-to-back (createPod/requestJoin, src/app/actions/pods.ts and
-- joins.ts, have no timing/frequency checks at all). This enforces a
-- simple per-user cooldown at the database level (not just in the server
-- actions) so it also covers any direct API call, mirroring the existing
-- "unique partial index" style of invariant enforcement already used for
-- pods_one_active_per_user.
--
-- Cooldowns are intentionally simple last-action-timestamp checks rather
-- than a sliding-window counter table — no new infra, and "one pod create
-- per 15s" / "one join request per 10s" is enough to stop rapid-fire abuse
-- without needing to count requests over a rolling window.

-- 1. Track the last time each user created a pod / sent a join request.
alter table profiles add column if not exists last_pod_created_at timestamptz;
alter table profiles add column if not exists last_join_request_at timestamptz;

-- 2. Pod-creation cooldown: 15 seconds between new pods per user.
create or replace function enforce_pod_creation_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select last_pod_created_at into v_last from profiles where id = new.user_id;

  if v_last is not null and v_last > now() - interval '15 seconds' then
    raise exception 'RATE_LIMITED_POD_CREATE';
  end if;

  update profiles set last_pod_created_at = now() where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists enforce_pod_creation_cooldown_trigger on pods;
create trigger enforce_pod_creation_cooldown_trigger
  before insert on pods
  for each row
  execute function enforce_pod_creation_cooldown();

-- 3. Join-request cooldown: 10 seconds between join requests per user
--    (pod_joins is only ever inserted with status = 'PENDING', via
--    requestJoin, so no need to filter on status here).
create or replace function enforce_join_request_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select last_join_request_at into v_last from profiles where id = new.user_id;

  if v_last is not null and v_last > now() - interval '10 seconds' then
    raise exception 'RATE_LIMITED_JOIN_REQUEST';
  end if;

  update profiles set last_join_request_at = now() where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists enforce_join_request_cooldown_trigger on pod_joins;
create trigger enforce_join_request_cooldown_trigger
  before insert on pod_joins
  for each row
  execute function enforce_join_request_cooldown();
