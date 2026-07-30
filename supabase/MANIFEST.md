# Supabase script manifest

This project's Supabase schema is **not** tracked by the Supabase CLI / migrations
tooling. Instead, `schema.sql` is the baseline DDL and everything under `sql/` is a
one-off script applied by hand via the Supabase SQL editor. This file is the record
of what's been applied where, in what order, so a second project (e.g. staging) can
be brought to parity and kept there.

This manifest tracks **apply history only** — not architecture. Schema, RLS, and
trigger design live in [SPECS.md](../SPECS.md) §3, and any change that adds/alters
schema, RLS, triggers, `GAMES_CONFIG`, server actions, routes, or screens must still
go through the `update-specs` skill to keep `SPECS.md` current, in addition to
getting a row here.

## Rule for new scripts

1. Add a row below before writing the script.
2. Apply to **staging** first via its SQL editor, smoke-test the affected feature.
3. Apply the identical file to **prod**.
4. Tick both boxes.

Never apply a new script to prod before it's been verified on staging.

## Applied scripts

| Order | File                                           | Prod applied   | Staging applied | Notes                                                                                                                                                                                         |
| ----- | ---------------------------------------------- | -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `schema.sql`                                   | [x] 2026-07-27 | [x]             | Baseline DDL. Has `DROP ... IF EXISTS` guards — only safe to run in full against an **empty** project.                                                                                        |
| 2     | `sql/account_deletion.sql`                     | [x] 2026-07-27 | [x]             |                                                                                                                                                                                               |
| 3     | `sql/inactive_pod_cleanup.sql`                 | [x] 2026-07-27 | [x]             | Adds a `notification_type` enum value and uses it later in the same file — run statement 1 alone first, then the rest. Also schedules a `pg_cron` job; verify with `select * from cron.job;`. |
| 4     | `sql/matched_notification_seen.sql`            | [x] 2026-07-27 | [x]             |                                                                                                                                                                                               |
| 5     | `sql/matched_pod_cleanup.sql`                  | [x] 2026-07-27 | [x]             | Schedules a `pg_cron` job; verify with `select * from cron.job;`.                                                                                                                             |
| 6     | `sql/rate_limits.sql`                          | [x] 2026-07-28 | [x]             |                                                                                                                                                                                               |
| 7     | `sql/notify_pending_joiners_on_pod_update.sql` | [x] 2026-07-29 | [x]             | Adds a `notification_type` enum value and uses it later in the same file — run statement 1 alone first, then the rest.                                                                        |
| 8     | `sql/notify_pod_destroyed.sql`                 | [x] 2026-07-29 | [x]             | Adds a `notification_type` enum value and uses it later in the same file — run statement 1 alone first, then the rest.                                                                        |
| 9     | `sql/pod_history.sql`                          | [x] 2026-07-29 | [x]             |                                                                                                                                                                                               |
| 10    | `sql/scale_indexes.sql`                        | [x] 2026-07-29 | [x]             |                                                                                                                                                                                               |
| 11    | `sql/fix_pod_join_delete_notify_actor.sql`     | [x] 2026-07-29 | [x]             | `create or replace function` patch on `notify_on_pod_join_delete` (defined in `schema.sql`) — just needs to run after the baseline, no other ordering dependency.                             |
| 12    | `sql/profile_pod_stats.sql`                    | [x] 2026-07-30 | [x]             | Adds `get_profile_pod_stats()` only — no table/RLS change. Depends on `pod_history` existing (order 9).                                                                                       |

Dates above are the file's last-modified date at the time this manifest was
created (2026-07-29), used as a best-effort proxy for real apply order/date since
no prior tracking existed.
