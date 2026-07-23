---
name: update-specs
description: >-
  Keeps SPECS.md (this project's PRD & technical spec) in sync with the
  codebase. Use this skill whenever you finish implementing, changing, or
  removing a feature in this repo — new/changed database tables, columns,
  RLS policies, triggers, server actions, routes, components, screens,
  UI flows, or entries in GAMES_CONFIG. Also use it when the user says things
  like "update the specs", "does SPECS.md need updating", "document this
  change", or after any task described in AGENTS.md's "keep SPECS.md current"
  rule. Do NOT use it for pure refactors, styling tweaks, or bug fixes that
  don't change behavior, schema, or UX — SPECS.md documents current-state
  product/architecture truth, not a changelog of every commit.
---

# Update SPECS.md

`SPECS.md` is this project's single source of truth for architecture, schema,
RLS, and UX flows — not a historical changelog. Every time a feature is added,
changed, or removed, the relevant section(s) should be edited in place so the
document always reads as if it were freshly written for the app as it exists
right now. Stale or missing spec sections are worse than no spec at all,
because future work (by you or anyone else) will trust what's written there.

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

## How SPECS.md is organized

| Section | Covers | Edit when you touch... |
|---|---|---|
| 1. System Architecture & Tech Stack | Frameworks, libraries | A new major dependency or architectural shift |
| 2. Authentication | Discord OAuth, route gating | Auth flow, `proxy.ts`, callback route |
| 3. Polymorphic Database Schema | Tables, RLS table, realtime | Any schema/RLS/trigger change (also update `supabase/schema.sql` itself if it exists) |
| 4. Core Extensibility Architecture | `GAMES_CONFIG` | New game/format, tier behavior |
| 5. UI/UX Interface Layout & Screen Flows | Screens, dialogs, step-by-step flows | New/changed screen, dialog, or user-facing flow |
| 6. Match Feed Query Layout | The live filtering query | Changes to how beacons are matched/filtered |
| 7. Progressive Web App Scope | Manifest, notification delivery | PWA/notification behavior changes |
| 8. Explicit Scope Exclusions | What's deliberately not built | Something exclusion-listed here just got implemented (remove/move it), or a new deliberate exclusion was decided |
| 9. AI Agent Implementation Steps | Numbered build steps | A genuinely new feature (add the next numbered step); don't rewrite existing steps for minor tweaks |

## Process

1. **Identify what actually changed** from the work you just did (diff, or
   your own memory of the task) — schema columns, a new component, a changed
   server action signature, a new screen, etc.
2. **Find the matching section(s)** using the table above. Most changes only
   touch one or two sections; RLS/schema changes often need both Section 3's
   SQL block *and* its RLS table updated together.
3. **Edit in place, don't append.** Rewrite the sentence/paragraph/table row
   that's now wrong. If a whole new sub-flow was added (e.g. a new dialog),
   add it as a new bullet/paragraph in the right screen's subsection, in the
   same numbered-step or prose style as its neighbors.
4. **Match the existing voice.** SPECS.md is dense and technical, written in
   full sentences, not terse notes. It uses:
   - Blockquote callouts (`>`) for the *why* behind a non-obvious decision
     (see the RLS-recursion callout in Section 3) — use these when the change
     has a gotcha someone would otherwise rediscover the hard way.
   - Markdown tables for structured rules (e.g. the RLS policy table).
   - Fenced code blocks for schema/SQL/TypeScript that should match the real
     source exactly — copy from the actual file rather than retyping from
     memory.
5. **Reconcile cross-references.** A schema change can ripple: a new column
   might need a new RLS policy row, a new server action, and a new sentence in
   Section 5's screen flow. A quick self-check: does anything else in the
   document now contradict what you just edited?
6. **Update Section 9 only for genuinely new features**, appending the next
   numbered step in the same imperative, file-referencing style as the
   existing ones (e.g. "Add X per Section Y"). Don't renumber or rewrite past
   steps to reflect small follow-up tweaks — they're a historical build log.
7. **Move completed exclusions.** If something listed in Section 8 as
   out-of-scope just got built, remove that bullet (or narrow it if only part
   of it was built) instead of leaving it contradicting the rest of the doc.
8. **When in doubt about a section split**, prefer keeping related info
   together over strict section purity — SPECS.md is meant to be read as
   documentation, not database-normalized data.

## Example

Input: You just added a `MAX_PLAYERS` hard cap increase from 6 to 8, adding a
new `preferred_max_players` CHECK constraint value and bumping the stepper's
max in `LfgDialog`.

Output: Edit the `CHECK (preferred_max_players BETWEEN 2 AND 6)` constraints
in Section 3's SQL block (both `profiles` and `beacons`) to `BETWEEN 2 AND 8`,
update the RLS table only if a policy referenced the old bound, and update
Section 5's "Players Needed Stepper" bullet from "(2–6, default 2)" to
"(2–8, default 2)". No new Section 9 step needed — this is a tuning change,
not a new feature.
