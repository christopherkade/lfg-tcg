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

First, set up a Supabase project and run the schema in `supabase/schema.sql` (plus the scripts under `supabase/sql/`) via the SQL editor. Add your project credentials to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Documentation

See [SPECS.md](./SPECS.md) for the full product and technical specification, including the database schema, RLS policies, and screen-by-screen UX flows.
