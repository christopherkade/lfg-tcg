# Product Requirement Document (PRD) & Technical Specification

**Project:** Cross-TCG LFG Matchmaker (PodFinder PWA)
**Stack:** Next.js (App Router), Supabase (Auth, Database, Realtime), Tailwind CSS, Framer Motion.
**Approach:** Mobile-first Progressive Web App (PWA) focusing on real-time LFG matchmaking for IRL and Online play, initializing from a robust user profile preference system.

---

## Index

This document used to hold the full spec inline; it's now a table of contents. Each section lives in its own file under `docs/specs/`, so an agent working on a schema change only needs to open `03-schema.md`, not the whole spec. **Open only the file(s) relevant to your change** — see the `update-specs` skill (`.github/skills/update-specs/SKILL.md`) for the section-to-file routing table used when updating these docs.

| # | Section | File | What's inside |
| - | --- | --- | --- |
| 1 | System Architecture & Tech Stack | [`docs/specs/01-architecture.md`](docs/specs/01-architecture.md) | Frontend/backend stack, realtime subscriptions, i18n (EN/FR) layer, light/dark theming |
| 2 | Authentication | [`docs/specs/02-auth.md`](docs/specs/02-auth.md) | Discord OAuth, route gating (`proxy.ts`, `requireUser`/`requireProfile`), `next` return-to-destination, Terms/Privacy pages |
| 3 | Polymorphic Database Schema | [`docs/specs/03-schema.md`](docs/specs/03-schema.md) | Full SQL DDL, RLS policy table, Realtime config, cleanup cron jobs, Organiser Tables (recurring weekly events), Admin Review (organizer applications) |
| 4 | Core Extensibility Architecture (`GAMES_CONFIG`) | [`docs/specs/04-games-config.md`](docs/specs/04-games-config.md) | `GAMES_CONFIG`/`PLAYSTYLE_OPTIONS`, `CITIES_CONFIG`/`CITY_MAP` city scoping |
| 5 | UI/UX Interface Layout & Screen Flows | [`docs/specs/05-ui-ux-flows.md`](docs/specs/05-ui-ux-flows.md) | Navigation shell, Profile/LFG/Active Pods/History/Organiser Dashboard/Admin Applications screens, Join Request Flow, Public Profile Side Panel, 404 |
| 6 | Match Feed Query Layout | [`docs/specs/06-match-feed-query.md`](docs/specs/06-match-feed-query.md) | `MatchFeed`'s filter state, city-scoping query logic, `fetchActivePods` reference implementation |
| 7 | Progressive Web App Scope | [`docs/specs/07-pwa-scope.md`](docs/specs/07-pwa-scope.md) | Installability manifest, foreground-only notification center (no push/service worker) |
| 8 | Explicit Scope Exclusions | [`docs/specs/08-scope-exclusions.md`](docs/specs/08-scope-exclusions.md) | What's deliberately not built (push, geolocation, pagination, Discord automation, etc.) |
| 9 | AI Agent Implementation Steps | [`docs/specs/09-agent-implementation-steps.md`](docs/specs/09-agent-implementation-steps.md) | Chronological build log — 52 numbered implementation steps |

If you have questions at any point, ask me directly.

ALWAYS keep these docs up to date with new features and changes — see the `update-specs` skill.
