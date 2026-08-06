---
name: update-specs
description: >-
  Keeps SPECS.md and docs/specs/*.md (this project's PRD & technical spec) in
  sync with the codebase. Use this skill whenever you finish implementing,
  changing, or removing a feature in this repo — new/changed database tables,
  columns, RLS policies, triggers, server actions, routes, components,
  screens, UI flows, or entries in GAMES_CONFIG. Also use it when the user
  says things like "update the specs", "does SPECS.md need updating",
  "document this change", or after any task described in AGENTS.md's "keep
  SPECS.md current" rule. Do NOT use it for pure refactors, styling tweaks, or
  bug fixes that don't change behavior, schema, or UX — these docs document
  current-state product/architecture truth, not a changelog of every commit.
---

# Update SPECS.md

`SPECS.md` is a table of contents; the actual spec content — architecture,
schema, RLS, and UX flows — lives split across `docs/specs/01-*.md` through
`docs/specs/09-*.md`, one file per section, not a historical changelog. Every
time a feature is added, changed, or removed, the relevant file(s) should be
edited in place so each document always reads as if it were freshly written
for the app as it exists right now. Stale or missing spec content is worse
than no spec at all, because future work (by you or anyone else) will trust
what's written there.

**Open only the file(s) that match your diff.** Don't read the whole
`docs/specs/` directory or `SPECS.md`'s full history for a change that only
touches one section — that defeats the reason these docs were split out of a
single ~44K-token file in the first place. Use the table below to go straight
to the right file(s).

## When to act

Trigger this after finishing a change that touches any of:

- The Supabase schema, RLS policies, or SECURITY DEFINER triggers (`supabase/schema.sql`)
- `GAMES_CONFIG` in `src/constants/gamesConfig.ts` (new game, format, or tier behavior)
- Server actions in `src/app/actions/` (new action, or a changed contract/side-effect)
- Routes/screens under `src/app/` (new screen, new tab, changed navigation)
- Components that implement a described UI flow (dialogs, feed filtering, notifications)
- Anything explicitly called out as out-of-scope in Section 8 that just got built

Skip it for internal refactors, renames with no behavioral change, dependency
bumps, styling-only tweaks, or test-only changes — none of those change what
SPECS.md needs to say.

## How the docs are organized

| # | File | Covers | Edit when you touch... |
|---|---|---|---|
| 1 | `docs/specs/01-architecture.md` | Frameworks, libraries, i18n, theming | A new major dependency or architectural shift |
| 2 | `docs/specs/02-auth.md` | Discord OAuth, route gating | Auth flow, `proxy.ts`, callback route |
| 3 | `docs/specs/03-schema.md` | Tables, RLS table, realtime | Any schema/RLS/trigger change (also update `supabase/schema.sql` itself if it exists) |
| 4 | `docs/specs/04-games-config.md` | `GAMES_CONFIG`, `CITIES_CONFIG` | New game/format, tier behavior, city list changes |
| 5 | `docs/specs/05-ui-ux-flows.md` | Screens, dialogs, step-by-step flows | New/changed screen, dialog, or user-facing flow |
| 6 | `docs/specs/06-match-feed-query.md` | The live filtering query | Changes to how pods are matched/filtered |
| 7 | `docs/specs/07-pwa-scope.md` | Manifest, notification delivery | PWA/notification behavior changes |
| 8 | `docs/specs/08-scope-exclusions.md` | What's deliberately not built | Something exclusion-listed here just got implemented (remove/move it), or a new deliberate exclusion was decided |
| 9 | `docs/specs/09-agent-implementation-steps.md` | Numbered build steps | A genuinely new feature (add the next numbered step); don't rewrite existing steps for minor tweaks |

`SPECS.md` itself only needs an edit when a section's one-line description in
its index table goes stale (rare) — otherwise never open it for a content
change, only for the initial "which file do I need" lookup.

## Process

1. **Identify what actually changed** from the work you just did (diff, or
   your own memory of the task) — schema columns, a new component, a changed
   server action signature, a new screen, etc.
2. **Find the matching file(s)** using the table above, and read only those —
   most changes only touch one or two files; RLS/schema changes often need
   both `03-schema.md`'s SQL block *and* its RLS table updated together.
3. **Edit in place, don't append.** Rewrite the sentence/paragraph/table row
   that's now wrong. If a whole new sub-flow was added (e.g. a new dialog),
   add it as a new bullet/paragraph in the right screen's subsection, in the
   same numbered-step or prose style as its neighbors.
4. **Match the existing voice.** These docs are dense and technical, written
   in full sentences, not terse notes. They use:
   - Blockquote callouts (`>`) for the *why* behind a non-obvious decision
     (see the RLS-recursion callout in `03-schema.md`) — use these when the
     change has a gotcha someone would otherwise rediscover the hard way.
   - Markdown tables for structured rules (e.g. the RLS policy table).
   - Fenced code blocks for schema/SQL/TypeScript that should match the real
     source exactly — copy from the actual file rather than retyping from
     memory.
5. **Reconcile cross-references.** A schema change can ripple: a new column
   might need a new RLS policy row, a new server action, and a new sentence in
   `05-ui-ux-flows.md`'s screen flow. Check whether the change also touches
   another `docs/specs/*.md` file, and whether that section's one-line
   description in `SPECS.md`'s index table needs updating too. Internal prose
   cross-references (e.g. "see Section 3") are unaffected by the file split
   and don't need rewriting — the section numbering is unchanged, only its
   physical location moved from a heading to a filename.
6. **Update `09-agent-implementation-steps.md` only for genuinely new
   features**, appending the next numbered step in the same imperative,
   file-referencing style as the existing ones (e.g. "Add X per Section Y").
   Don't renumber or rewrite past steps to reflect small follow-up tweaks —
   they're a historical build log.
7. **Move completed exclusions.** If something listed in
   `08-scope-exclusions.md` as out-of-scope just got built, remove that
   bullet (or narrow it if only part of it was built) instead of leaving it
   contradicting the rest of the docs.
8. **When in doubt about a section split**, prefer keeping related info
   together over strict section purity — these docs are meant to be read as
   documentation, not database-normalized data.

## Example

Input: You just added a `MAX_PLAYERS` hard cap increase from 6 to 8, adding a
new `preferred_max_players` CHECK constraint value and bumping the stepper's
max in `LfgDialog`.

Output: Edit the `CHECK (preferred_max_players BETWEEN 2 AND 6)` constraints
in `docs/specs/03-schema.md`'s SQL block (both `profiles` and `pods`) to
`BETWEEN 2 AND 8`, update the RLS table only if a policy referenced the old
bound, and update `docs/specs/05-ui-ux-flows.md`'s "Players Needed Stepper"
bullet from "(2–6, default 2)" to "(2–8, default 2)". No new
`09-agent-implementation-steps.md` step needed — this is a tuning change, not
a new feature.
