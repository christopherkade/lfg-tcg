# PodFinder

PodFinder is a mobile-first Progressive Web App for finding people to play trading card games with, both online and in person. Post an LFG (looking for group) request, get matched in real time, and coordinate the game over Discord.

## Features

- **Cross-game support** — Magic: The Gathering (with Commander power-bracket matching), One Piece TCG, Pokémon TCG, and Disney Lorcana out of the box, with more games addable via a single config entry.
- **Real-time matchmaking** — Post a search (game, format, playstyle, IRL or Online, group size) and browse a live-updating feed of other active pods, filterable by game, format, match type, date, and power bracket.
- **Host-managed pods** — Hosts review incoming join requests, accept or reject them, track group fill progress, and mark a pod as matched once the group is set.
- **IRL city scoping** — In-person pods are automatically scoped to the player's city so local games don't get lost in a global feed.
- **Notification center** — A persisted, real-time notification bell covers join requests, acceptances/rejections, pod updates, members leaving, and more, backed by an OS-level notification, in-app toast, and chime while the app is open.
- **Shareable pod links** — Every active pod has a stable link that can be shared directly, with logged-out visitors routed through login and back.
- **Pod history** — A "Past Pods" log of every matched pod a player hosted or joined, including a lifetime "games played" stat.
- **Discord-first identity** — Sign in with Discord OAuth; matched players exchange Discord handles to coordinate and play.
- **Light/dark theming and English/French localization**, both switchable from an in-app settings dialog.
- **Installable PWA** — Add PodFinder to your home screen for an app-like experience.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router)
- **Backend:** [Supabase](https://supabase.com) — PostgreSQL, Auth (Discord OAuth), Row Level Security, and Realtime subscriptions
- **UI:** Tailwind CSS, MUI, Framer Motion

## Getting Started

First, set up a Supabase project and run the schema in `supabase/schema.sql` (plus the scripts under `supabase/sql/`, in the order tracked in [`supabase/MANIFEST.md`](./supabase/MANIFEST.md)) via the SQL editor. Copy [`.env.example`](./.env.example) to `.env.local` and fill in your project credentials.

Then run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environments

- `main` -> production deployment, production Supabase project, production Discord OAuth app.
- `staging` -> staging deployment, a separate Supabase project, a separate Discord OAuth app. Feature branches target `staging`; once verified there, `staging` is promoted to `main`.

Schema/RLS changes are applied to staging first, then prod — see [`supabase/MANIFEST.md`](./supabase/MANIFEST.md) for the apply order and history.

### Testing against staging or prod locally

`next dev` always runs with `NODE_ENV=development`, so Next's usual `.env.production` convention doesn't help here — it never applies locally. Instead, two explicit env files let you point your local dev server at either backend without ever touching `.env.local`:

- `.env.staging.local` — staging Supabase project credentials.
- `.env.production.local` — production Supabase project credentials.

Both are gitignored, same as `.env.local`. Then run:

```bash
yarn dev:staging   # local dev server against the staging Supabase project
yarn dev:prod      # local dev server against the production Supabase project
```

Plain `yarn dev` keeps using `.env.local` as before. Since prod credentials in `.env.production.local` are real, prefer read-only testing against it and do write-testing on staging.

## Documentation

See [SPECS.md](./SPECS.md) for an index into the full product and technical specification (split across `docs/specs/`), including the database schema, RLS policies, and screen-by-screen UX flows.
