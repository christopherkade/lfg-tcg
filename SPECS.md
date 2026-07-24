# Product Requirement Document (PRD) & Technical Specification

**Project:** Cross-TCG LFG Matchmaker (PodMaker PWA)
**Stack:** Next.js (App Router), Supabase (Auth, Database, Realtime), Tailwind CSS, Framer Motion.
**Approach:** Mobile-first Progressive Web App (PWA) focusing on real-time LFG matchmaking for IRL and Online play, initializing from a robust user profile preference system.

---

## 1. System Architecture & Tech Stack

### Frontend

- **Framework:** Next.js (App Router, leveraging Client Components for reactive settings forms and real-time pod feed updates).
- **Navigation:** A three-tab information architecture — **Active Pods**, **LFG**, **Profile** — rendered as a fixed bottom tab bar with icons on mobile, and a top navbar with icon + label on desktop (`sm:` breakpoint and up). See Section 5 for the full screen breakdown.
- **Styling:** Tailwind CSS, designed mobile-first.
- **Animations:** **Framer Motion** for conditional layout morphing (the Profile screen's power bracket picker) and the active pod pulse.

### Backend & Realtime

- **Database & Auth:** Supabase (PostgreSQL with Row Level Security). Authentication via Discord OAuth only (see Section 2).
- **Realtime Subscriptions:** Enabled on the `pods`, `pod_joins`, and `notifications` tables to push instant matching feeds and notification-center updates.
- **Notification center:** A persisted `notifications` table (populated exclusively by SECURITY DEFINER database triggers, not application code) backs a header bell with an unread-count badge — see Section 3's Notifications subsection and Section 7.

### Localization (English / French)

- **Approach:** A lightweight, dependency-free i18n layer under `src/lib/i18n/` — no `next-intl`/`next-i18next`. Two flat JSON dictionaries (`dictionaries/en.json`, `dictionaries/fr.json`, one key per UI string) are looked up via `translate(locale, key, vars?)`, which does `{placeholder}` substitution for interpolated strings (e.g. server-action errors that embed a raw Supabase `error.message`).
- **Locale storage:** A `pm_locale` cookie (`en` | `fr`, default `en`) — not a `profiles` column, since this is a device/browser-level display preference rather than account data. No URL locale segments (`/en/`, `/fr/`); routes are unchanged.
- **Client wiring:** `LocaleProvider`/`useTranslation()` (`src/lib/i18n/LocaleContext.tsx`) expose `{ locale, setLocale, t }` via React Context, mounted once in the root layout around `ThemeRegistry`. `setLocale` updates both React state and the `pm_locale` cookie directly (`document.cookie`) so the next server render picks it up — no server round-trip needed for the switch itself. Every text-bearing component in `src/components/` is a Client Component, so this hook is the only wiring those components need.
- **Server wiring:** `getServerLocale()` (`src/lib/i18n/server.ts`) reads the cookie via `await cookies()` (same async pattern as `src/lib/supabase/server.ts`) for the root layout's `<html lang>` and initial `LocaleProvider` value, for the Profile screen's server-rendered heading, and inside every server action in `src/app/actions/` so returned `{ error }` strings are translated before crossing back to the client.
- **`LocaleSwitcher`** (`src/components/LocaleSwitcher.tsx`): an EN/FR segmented toggle, rendered in `TabBar` (both the mobile top bar and desktop navbar, next to `TutorialDialog`/`NotificationBell`) and in the top-right corner of `/login` (which has no `TabBar`).
- **Dates:** `formatPodWhen` (`src/lib/date.ts`) takes `(pod, locale, t)` and passes a `date-fns/locale` (`fr` or `undefined`) into every `format`/`formatDistanceToNowStrict` call, plus routes its wrapper phrases ("Starts in…", "Posted…", "Today, …") through `t()`. `NotificationBell`'s own relative-timestamp line does the same.
- **Not translated:** game names (`GAMES_CONFIG[key].name`, e.g. "Magic: The Gathering") and city labels (`CITIES_CONFIG`) are treated as proper nouns and stay as authored. Formats, power-bracket label, and playstyle options are translated via key-based lookups (`format.${key}`, `tier.powerBracket`, `playstyle.${key}`) resolved at render time, so `GAMES_CONFIG`'s shape didn't need to change. The `<title>`/`<meta description>` in the root layout's static `metadata` export remain English-only (SEO/crawler-facing, out of scope for this pass).

---

## 2. Authentication

- **Provider:** Discord OAuth via Supabase Auth (`supabase.auth.signInWithOAuth({ provider: 'discord' })`). No email/password or magic-link flow is supported.
- **Prerequisite (external, not code):** A Discord Developer Portal application (Client ID/Secret) registered as an OAuth provider in the Supabase project's Auth settings, with the Supabase-provided callback URL (`https://<project>.supabase.co/auth/v1/callback`) set as the Discord app's redirect URI.
- **Callback route:** `/auth/callback/route.ts` exchanges the OAuth `code` for a session (`exchangeCodeForSession`), then redirects to the `next` query param if present, falling back to `/`.
- **Discord handle prefill:** On first login, the user's Discord identity metadata (`user.user_metadata`) is used to prefill the `discord_handle` field on the Profile screen (identity fields only, see Section 5); the user can edit it before submitting.
- **Route gating:**
  - `proxy.ts` (this Next.js version's renamed `middleware.ts`) performs an _optimistic_ check for the Supabase auth cookie and redirects unauthenticated requests to `/login` (except `/login` and `/auth/callback` themselves). Proxy is not a substitute for real session validation.
  - The real gate is server-side: each protected Server Component queries `profiles` by `auth.uid()`. If no session exists, redirect to `/login`. If a session exists but no `profiles` row exists yet, redirect to `/profile` to force onboarding before the LFG or Active Pods tabs can be reached.
- **Return-to-destination after login (`next`):** so a logged-out visit to a deep link (e.g. a shared `/pods/<id>` pod link, Section 5) isn't lost, the originally-requested path is threaded end-to-end through the login round trip: `proxy.ts` appends `?next=<path>` onto its `/login` redirect; `requireUser`/`requireProfile` (`src/lib/session.ts`) accept an optional `path` argument from the calling page (e.g. `/pods/<id>`'s own page passes its own path) and do the same for their `/login` redirect, since proxy's check is only optimistic and the page-level gate is the one that actually runs; `/login`'s page reads `next` from its own `searchParams` (Server Component) and passes it down to the client `LoginView`, which appends it onto the `redirectTo` URL passed to `signInWithOAuth` (as `/auth/callback?next=<path>`); the callback route (above) then redirects there once the session is established. If the account has no `profiles` row yet, the onboarding redirect to `/profile` does not currently carry `next` through — a brand-new user finishes onboarding at the default destination rather than the original deep link.

---

## 3. Polymorphic Database Schema (PostgreSQL / Supabase)

Execute this SQL snippet in your Supabase SQL Editor. The canonical, up-to-date copy of this script lives at `supabase/schema.sql` (it also includes `DROP ... IF EXISTS` statements at the top so it can be re-run cleanly during development — remove that block before running against a project with real user data).

> **Important:** Every `preferred_*` column on `profiles` has a sensible default (see DDL below), so a brand-new profile row — created with only `id`/`username`/`discord_handle` from the Profile screen's identity form — is valid immediately without the constraints failing. This is what allows onboarding to stay a simple two-field form while the LFG search dialog (Section 5) still has real values to pre-fill with on first use.
>
> **Profile stores the _last-used_ search settings, not a fixed preference.** Game, format, playstyle, acceptable power brackets, match type, location, and desired group size are edited exclusively via the "Search" dialog on the LFG tab (not the Profile screen). Every time `createPod` runs, it both (a) updates these `preferred_*` columns to match what was just searched for, and (b) snapshots them into the new `pods` row. This keeps the dialog's next pre-fill, and the Match Feed's filtering, in sync with the user's most recent search.
>
> **`city` is the one profile column that's identity-like rather than a `preferred_*` search setting.** It's edited on the Profile screen (via `CitySelector`, alongside username/discord handle) rather than the LFG Search dialog, because it describes where the user generally is, not something they re-pick per search. `createPod`/`updatePod` still snapshot it onto each `pods` row (same pattern as the `preferred_*` columns) so the Match Feed (Section 6) can scope IRL pods by a plain column filter without joining back to `profiles`.
>
> **City is a config-driven slug, not free text — see `constants/citiesConfig.ts` (`CITIES_CONFIG`/`CITY_MAP`).** It mirrors `GAMES_CONFIG`'s extensibility pattern (Section 4): supporting a new city is a one-line addition to that array, no schema/migration needed. Using a stable slug (not the free-text `location_name` a searcher types per-pod) is what lets the Match Feed (Section 6) scope IRL pods to the viewer's city with a plain equality check instead of unreliable fuzzy text matching. `profiles.city` is optional — set once on the Profile screen (Section 5) like `username`/`discord_handle`, not part of the per-search "Search" dialog — and every `createPod`/`updatePod` call snapshots its current value onto the pod's own `city` column, the same way the other `preferred_*` columns are snapshotted onto their pod counterparts.
>
> **`pods` SELECT RLS must include accepted members, not just `status = 'ACTIVE'` or the owner.** Supabase Realtime's `postgres_changes` re-checks a table's SELECT policy against the row being changed for every single subscriber, on every event — if that check fails for a given subscriber, they simply never receive the event (no error, it's silent). If the policy were only `status = 'ACTIVE' OR user_id = auth.uid()`, then the instant a host marks their pod `MATCHED`, every accepted member's subscription would start failing that check (they're neither `ACTIVE` nor the owner), so they'd never find out: `MatchedPodWatcher`'s `MatchedDialog` wouldn't fire for them, and their own `MatchFeed` would keep showing the now-stale card forever (no event ever tells their client to refetch and drop it). The fix is allowing accepted members through the policy regardless of the pod's current `status`.
>
> **That accepted-member check must go through the `public.is_accepted_pod_member(uuid)` SECURITY DEFINER function, not an inline `exists (select 1 from pod_joins ...)`.** `pod_joins`'s own SELECT policy queries `pods` back (to check host ownership), so an inline subquery on `pods` creates a policy cycle — pods policy → pod_joins policy → pods policy → ... — which Postgres rejects with `infinite recursion detected in policy for relation "pods"`. The SECURITY DEFINER function runs as its (RLS-bypassing) owner, so its internal query against `pod_joins` doesn't re-trigger `pod_joins`'s RLS policy, breaking the cycle.

```sql
-- Baseline system enums
CREATE TYPE match_type AS ENUM ('IRL', 'ONLINE');
CREATE TYPE join_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- 1. Profiles Table (stores user identity, plus the last-used LFG search
-- settings edited via the LFG tab's "Search" dialog)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    username TEXT UNIQUE NOT NULL,
    discord_handle TEXT NOT NULL,
    avatar_url TEXT,
    city TEXT,                                            -- key into CITIES_CONFIG (constants/citiesConfig.ts), optional (NULL if unset, e.g. Online-only players)
    preferred_game TEXT NOT NULL DEFAULT 'MTG',          -- e.g., 'MTG', 'POKEMON', 'ONE_PIECE', 'LORCANA'
    preferred_format TEXT NOT NULL DEFAULT 'COMMANDER',  -- e.g., 'COMMANDER', 'STANDARD' (one of GAMES_CONFIG[game].formats)
    preferred_playstyle TEXT NOT NULL DEFAULT 'casual',  -- 'casual' or 'competitive'
    preferred_brackets INT[] DEFAULT ARRAY[1,2,3,4,5],   -- multi-select 1-5, only for preferred_game == 'MTG'
    preferred_match_type match_type NOT NULL DEFAULT 'ONLINE',
    preferred_location_name TEXT,                        -- required (non-empty) if preferred_match_type == 'IRL', else NULL
    preferred_max_players INT NOT NULL DEFAULT 2 CHECK (preferred_max_players BETWEEN 2 AND 6),
    CONSTRAINT bracket_conditional_check CHECK (
        (preferred_game = 'MTG' AND preferred_brackets IS NOT NULL AND array_length(preferred_brackets, 1) > 0 AND preferred_brackets <@ ARRAY[1,2,3,4,5]) OR
        (preferred_game != 'MTG' AND (preferred_brackets IS NULL OR array_length(preferred_brackets, 1) IS NULL))
    ),
    CONSTRAINT location_conditional_check CHECK (
        (preferred_match_type = 'IRL' AND preferred_location_name IS NOT NULL AND length(trim(preferred_location_name)) > 0) OR
        (preferred_match_type = 'ONLINE' AND preferred_location_name IS NULL)
    )
);

-- 2. Pods Table (active LFG requests, snapshotting the host's profile settings)
CREATE TABLE pods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    game_key TEXT NOT NULL,
    format_key TEXT NOT NULL,        -- e.g., 'COMMANDER', 'STANDARD'
    playstyle_key TEXT NOT NULL,     -- 'casual' or 'competitive'
    power_tiers INT[] CHECK (power_tiers IS NULL OR power_tiers <@ ARRAY[1,2,3,4,5]), -- snapshot of profiles.preferred_brackets if MTG, NULL otherwise
    type match_type NOT NULL,        -- 'IRL' or 'ONLINE'
    location_name TEXT,              -- E.g., 'Local Game Store Name' (Null if ONLINE)
    city TEXT,                       -- snapshot of profiles.city at creation/edit time; drives Match Feed IRL scoping (Section 6)
    scheduled_at TIMESTAMP WITH TIME ZONE, -- app-level required date/time for IRL matches (see validateStartSearchInput, not a DB CHECK); NULL for ONLINE, which falls back to created_at for display and the Match Feed's Date filter (Section 6)
    max_players INT NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 6), -- Total group size including the host; snapshot of preferred_max_players
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 300), -- Optional free-text note set in the Search dialog, one-off (not persisted onto profiles)
    status TEXT DEFAULT 'ACTIVE',    -- 'ACTIVE', 'MATCHED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '4 hours'),
    matched_at TIMESTAMP WITH TIME ZONE -- set by markPodMatched when status -> MATCHED; drives the retention sweep below
);

-- Enforce a single ACTIVE pod per user
CREATE UNIQUE INDEX pods_one_active_per_user ON pods(user_id) WHERE status = 'ACTIVE';

-- 3. Pod Joins (Join requests, subject to host approval)
CREATE TABLE pod_joins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID REFERENCES pods(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status join_status NOT NULL DEFAULT 'PENDING',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_pod UNIQUE (pod_id, user_id)
);

-- 4. Notifications (persisted notification center backing the header bell)
CREATE TYPE notification_type AS ENUM (
    'JOIN_REQUEST', 'JOIN_ACCEPTED', 'JOIN_REJECTED', 'MEMBER_LEFT', 'REMOVED_FROM_POD', 'POD_UPDATED', 'POD_DESTROYED', 'POD_EXPIRED_INACTIVITY'
);
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    pod_id UUID REFERENCES pods(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

> **Notifications have no `message` column.** Display copy is composed client-side (`NotificationBell`'s `describeNotification()`) from `type` plus the embedded `actor`/`pod` rows — this keeps copy easy to change/localize later without needing to backfill historical rows.
>
> **Rows are inserted exclusively by SECURITY DEFINER database triggers or the `pg_cron` cleanup jobs below, never by application code.** `notify_on_pod_join_insert/update/delete` (on `pod_joins`), `notify_on_pod_update` (on `pods`), and `notify_on_pod_destroyed` (on `pods`, `supabase/sql/notify_pod_destroyed.sql`) — all defined alongside the RLS policies in `supabase/schema.sql` — cover, respectively: a new join request (host notified), a request accepted/rejected (joiner notified), an accepted member leaving (host notified), the host editing an already-live pod's details (every accepted member notified), and a pod being cancelled or replaced before it ever matched (every accepted member notified). The `sweep-inactive-active-pods` `pg_cron` job (`supabase/sql/inactive_pod_cleanup.sql`, see the Inactive Pod Cleanup subsection below) inserts the remaining `POD_EXPIRED_INACTIVITY` type directly, with `pod_id` left `NULL` since the pod is deleted in the same statement. Driving this from triggers/cron rather than the server actions in `src/app/actions/` means every current and future mutation path gets consistent notification coverage automatically, and lets `notifications` ship with **no client-facing INSERT policy at all** — a user can never fabricate a notification for someone else. A `MATCHED` status transition is deliberately **not** one of these types; it already has its own dedicated blocking `MatchedDialog` UX (via `MatchedPodWatcher`, see Section 5's Join Request Flow step 6), not a notification-center entry.

### Row Level Security

RLS must be enabled on all three tables with the following policies:

| Table           | Operation       | Rule                                                                                                                                                                                                                                                                                         |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`      | SELECT          | Any authenticated user (needed to display host/joiner info in the feed and join requests)                                                                                                                                                                                                    |
| `profiles`      | INSERT / UPDATE | Only where `auth.uid() = id`                                                                                                                                                                                                                                                                 |
| `pods`       | SELECT          | Where `status = 'ACTIVE'` OR `user_id = auth.uid()` (owners can always see their own pod) OR `public.is_accepted_pod_member(pods.id)` is true (accepted members keep visibility after it leaves `ACTIVE`, e.g. `MATCHED` — see the Realtime + RLS-recursion notes below the schema) |
| `pods`       | INSERT          | Only where `user_id = auth.uid()`                                                                                                                                                                                                                                                            |
| `pods`       | UPDATE          | Only where `user_id = auth.uid()` (status / `max_players` changes)                                                                                                                                                                                                                           |
| `pod_joins`  | SELECT          | Where `status = 'ACCEPTED'` (accepted members are public on active pods) OR `user_id = auth.uid()` (own requests) OR the pod is owned by `auth.uid()` (host reviewing requests)                                                                                                        |
| `pod_joins`  | INSERT          | Only where `user_id = auth.uid()` AND the target pod is not owned by `auth.uid()` (cannot join your own pod)                                                                                                                                                                           |
| `pod_joins`  | UPDATE          | Only where the target pod is owned by `auth.uid()` (only the host can Accept/Reject)                                                                                                                                                                                                      |
| `pod_joins`  | DELETE          | Only where `user_id = auth.uid()` (a joiner can cancel a PENDING request or leave after being ACCEPTED)                                                                                                                                                                                      |
| `notifications` | SELECT          | Only where `recipient_id = auth.uid()`                                                                                                                                                                                                                                                       |
| `notifications` | UPDATE          | Only where `recipient_id = auth.uid()` (marking read/all-read)                                                                                                                                                                                                                               |
| `notifications` | DELETE          | Only where `recipient_id = auth.uid()` (dismissing one notification or "Clear all")                                                                                                                                                                                                          |
| `notifications` | INSERT          | No policy for `authenticated` at all — every row is created by the SECURITY DEFINER trigger functions described above, which bypass RLS                                                                                                                                                      |

### Realtime

Enable Supabase Realtime replication on the `pods`, `pod_joins`, and `notifications` tables to push instant matching feed, join-request, and notification-center updates.

### Matched/Expired Pod Cleanup

An hourly `pg_cron` job (`sweep-matched-expired-pods`, defined in `supabase/sql/matched_pod_cleanup.sql`, applied directly in the Supabase SQL editor since this project has no tracked migrations) permanently deletes:

- `MATCHED` pods once `matched_at` is more than 24 hours old.
- `EXPIRED` pods once `expires_at` is more than 24 hours old.

The 24-hour grace window on `MATCHED` pods exists because `pod_joins` rows cascade-delete with their pod (`ON DELETE CASCADE`, above), and `MatchedPodWatcher` (Section 7) needs both rows to still exist in order to detect an accepted member's match and surface the `MatchedDialog` — an immediate delete on `markPodMatched` risks a member who wasn't actively polling missing that dialog entirely. Deleting a pod also cascades to its `notifications` rows, so any notification history tied to that pod (join requests, accept/reject, member-left) disappears with it once the sweep runs — this is accepted as intentional since `notifications` is a live inbox, not a permanent audit log.

### Inactive Pod Cleanup

A separate hourly `pg_cron` job (`sweep-inactive-active-pods`, defined in `supabase/sql/inactive_pod_cleanup.sql`) closes the gap the sweep above doesn't cover: a pod that never draws a join request (or a match) stays `status = 'ACTIVE'` forever — nothing else in the app ever flips it to `EXPIRED`. This job permanently deletes any `ACTIVE` pod whose `created_at` is more than 12 hours old, first inserting a `POD_EXPIRED_INACTIVITY` notification (`pod_id` left `NULL`, for the cascade-ordering reason noted above) for the host and every `ACCEPTED` member, in one `WITH ... DELETE` statement so the insert and delete run in the same transaction.

> Unlike `sweep-matched-expired-pods`, this job also has to *tell* someone before deleting, since an `ACTIVE` pod disappearing with zero notice would look like a bug rather than expected cleanup — `matched_pod_cleanup.sql`'s sweep only ever removes pods that already transitioned away from `ACTIVE` (and, for `EXPIRED`, were already cancelled/replaced by an action that itself notified members via `notify_on_pod_destroyed`).

---

## 4. Core Extensibility Architecture (`/constants/gamesConfig.ts`)

This configuration matrix drives both the Profile screen's settings form and the Active Pods match feed filtering.

```typescript
export interface GameSetting {
  name: string;
  themeColor: string; // Tailwind color classes
  glowColor: string; // RGBA value for custom Framer Motion shadows
  formats: { key: string; label: string }[];
  hasPowerTiers: boolean;
  tierLabel?: string;
  maxTier?: number;
}

export const GAMES_CONFIG: Record<string, GameSetting> = {
  MTG: {
    name: "Magic: The Gathering",
    themeColor: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    glowColor: "rgba(245, 158, 11, 0.4)",
    formats: [
      { key: "COMMANDER", label: "Commander" },
      { key: "STANDARD", label: "Standard" },
      { key: "MODERN", label: "Modern" },
    ],
    hasPowerTiers: true,
    tierLabel: "Power Bracket",
    maxTier: 5,
  },
  ONE_PIECE: {
    name: "One Piece TCG",
    themeColor: "text-blue-500 border-blue-500/30 bg-blue-500/10",
    glowColor: "rgba(59, 130, 246, 0.4)",
    formats: [{ key: "STANDARD", label: "Standard" }],
    hasPowerTiers: false,
  },
  POKEMON: {
    name: "Pokémon TCG",
    themeColor: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    glowColor: "rgba(234, 179, 8, 0.4)",
    formats: [
      { key: "STANDARD", label: "Standard" },
      { key: "EXPANDED", label: "Expanded" },
    ],
    hasPowerTiers: false,
  },
  LORCANA: {
    name: "Disney Lorcana",
    themeColor: "text-purple-500 border-purple-500/30 bg-purple-500/10",
    glowColor: "rgba(168, 85, 247, 0.4)",
    formats: [{ key: "CONSTRUCTED", label: "Core Constructed" }],
    hasPowerTiers: false,
  },
};

export const PLAYSTYLE_OPTIONS = [
  { key: "casual", label: "Casual" },
  { key: "competitive", label: "Competitive" },
];
```

### City Scoping (`/constants/citiesConfig.ts`)

A second, independent extensibility list following the exact same pattern, driving the Profile screen's City field and the Match Feed's IRL scoping (Section 6):

```typescript
export interface CitySetting {
  key: string;
  label: string;
}

// Adding a new city is a one-line addition here — no schema/migration
// needed. `key` is the stable slug persisted on profiles.city/pods.city.
export const CITIES_CONFIG: CitySetting[] = [
  { key: "new_york", label: "New York City" },
  { key: "los_angeles", label: "Los Angeles" },
  { key: "chicago", label: "Chicago" },
  { key: "toronto", label: "Toronto" },
  { key: "montreal", label: "Montreal" },
  { key: "vancouver", label: "Vancouver" },
  { key: "london", label: "London" },
  { key: "paris", label: "Paris" },
  { key: "berlin", label: "Berlin" },
  { key: "sydney", label: "Sydney" },
];

export const CITY_MAP: Record<string, CitySetting> = Object.fromEntries(
  CITIES_CONFIG.map((city) => [city.key, city]),
);
```

---

## 5. UI/UX Interface Layout & Screen Flows

### Navigation Shell

Three tabs, in this left-to-right order: **Active Pods**, **LFG**, **Profile**. `LFG` (`/`) is the middle tab and the default route. `Active Pods` (`/pods`) is on the left. `Profile` (`/profile`) is on the right.

- **Mobile:** a fixed bottom tab bar, one icon + label per tab.
- **Desktop (`sm:` and up):** a top navbar with the app name on the left and the three tabs (icon + label) on the right, replacing the bottom bar.
- **Tutorial button (`TutorialDialog`):** a question-mark icon button rendered directly to the left of `NotificationBell` in both the mobile top bar and the desktop navbar (same header row either way). Clicking it opens a modal walking through the app's core loop step by step (set up profile → start an LFG search → browse/get matched on Active Pods → host accepts join requests → notification bell → mark pod as matched). Purely informational — no state, no server calls.
- **Locale switcher (`LocaleSwitcher`):** an EN/FR toggle rendered alongside `TutorialDialog`/`NotificationBell` in both header rows (and separately, top-right, on `/login`, which has no `TabBar`). See Section 1's Localization subsection.

### Screen 1: Profile (`/profile/page.tsx`) — identity only

- **Standard Fields:** Text inputs for `username` and `discord_handle` (the latter prefilled from Discord OAuth identity metadata, see Section 2, and editable).
- **City Field (`CitySelector`):** A config-driven autocomplete (options from `CITIES_CONFIG`, see Section 4) selecting `profiles.city`. Optional — a user who only ever plays Online can leave it unset. This is what lets the Match Feed (Section 5's Screen 3, Section 6) automatically scope IRL pods to the viewer's own city while still always showing every Online pod.
- Saving submits `username`/`discord_handle`/`city` in one upsert to `profiles` (see Section 3); the `preferred_*` search-setting columns are left untouched by this form (they're edited via the LFG Search dialog instead, see Screen 2).
- **Sign Out:** A destructive-styled (red) button below the profile form that calls `supabase.auth.signOut()` and redirects to `/login`.

### Screen 2: LFG (`/page.tsx`) — action button + Search dialog

The LFG tab's base state renders **only the pulsing action button** (plus a small line summarizing the last-used game/format/match type read from the profile, and any inline error). There is no always-visible settings UI on this screen.

```
+---------------------------------------+
|                                       |
|            Last search                |
|     MTG · Commander · ONLINE          |  <-- Read-only summary from Profile
|                                       |
|                   /---\               |
|                  /     \              |
|                 |  LFG  |             |  <-- Big Glowing Pulse Button
|                  \     /              |
|                   \---/               |
+---------------------------------------+
```

1. **Clicking the LFG button while not searching** opens a **Search dialog** (modal, Framer Motion enter/exit) pre-filled with the profile's last-used settings:
   - **Game Selector:** Grid from `GAMES_CONFIG`. Changing it resets the format/bracket selections below to match the new game.
   - **Format Selector:** Button list of `GAMES_CONFIG[game].formats` (hidden when the game only has one format).
   - **Match Type Switch:** Segmented toggle between **IRL** and **ONLINE**.
   - **Location Field (conditional):** Required text input, shown only when Match Type is **IRL**.
   - **Scheduled Date & Time (conditional):** A `DatePicker` + `TimePicker` pair, required only when Match Type is **IRL** (combined into `pods.scheduled_at`). Left unset for **ONLINE** pods, which fall back to `created_at` wherever a pod's date/time is displayed or filtered (Match Feed cards, `PodDetailDialog`'s "When" row, and the Date filter in Section 6).
   - **Playstyle Toggle:** Segmented toggle between **Casual** and **Competitive**.
   - **Conditional Power Bracket Interface (Framer Motion Enhanced, multi-select):** Shown only when `selectedGame === 'MTG'`. Each of the 5 nodes toggles independently — any combination can be selected. Submission is blocked until at least one bracket is selected while the game is MTG; switching away from MTG clears the selection.
   - **Players Needed Stepper:** Numeric stepper (2–6, default 2) — total group size including the host. When editing an already-live pod (`updatePod`), this can't be lowered below the pod's current accepted group size (accepted `pod_joins` + the host) — `updatePod` re-checks that count server-side and rejects the edit with an error rather than silently shrinking the cap below who's already in.
   - **Notes Field (optional):** A free-text textarea (300 char max, with a live character counter) for anything else players should know (deck theme, house rules, etc.). Reset to empty each time the dialog opens — unlike the other fields, it is a one-off message for this search, not a persisted preference.
   - A **Search** button at the bottom of the dialog submits these fields (see `createPod` below); a **Cancel** button (or clicking the backdrop) closes the dialog without starting a search.
2. **Search Initialization:** Clicking **Search** calls `createPod` with the dialog's field values. This both (a) updates the user's `profiles.preferred_*` columns to match (so the dialog pre-fills with this search next time, and the Match Feed keeps filtering off it), and (b) snapshots those same values into a new `pods` row (game, format, playstyle, brackets → `power_tiers`, match type, location, `max_players`, notes). The `notes` value is stored only on the `pods` row, not persisted onto `profiles`. Blocked if the user already has an ACTIVE pod (enforced by the `pods_one_active_per_user` index). On success the dialog closes and the user is immediately navigated to the Active Pods tab (`/pods?highlight=own`) rather than staying on this screen — see **My Pod Panel**'s highlight behavior below. The LFG button itself still starts its infinite pulsing glow animation (mapped to the current game's `glowColor`) so it reflects the active search whenever the user is back on this screen.
3. **Search Resignation:** While searching, clicking the button (now showing **CANCEL**) directly flips the pod's `status` to `EXPIRED` — no dialog involved.

### Screen 3: Active Pods (`/pods/page.tsx`) — browse + host management

The left tab. Combines the Match Feed (browsing others' pods) with the host's own Pod Panel (if they have an ACTIVE pod), so all pod-related activity lives in one place separate from the LFG action button. The Match Feed's filter bar (see below) is always shown above the feed, even with zero results, so its "No active pods match your filters yet." message renders directly beneath the filters/heading rather than centered in the remaining screen space.

The screen's own-pod fetch + layout is shared between two routes via `PodsView` (`/app/(app)/pods/PodsView.tsx`, a server component): the flat `/pods` route above, and `/pods/[id]` — this app's first dynamic route segment — used for shareable pod links (see below).

**Sharing a pod:** every ACTIVE pod has a stable link, `/pods/<pod.id>`. My Pod Panel (below) has a **Copy Link** button, alongside its Copy Handle buttons, that copies `<origin>/pods/<pod.id>` to the clipboard. A logged-out visitor is sent to `/login` first and returned to this same URL after completing Discord OAuth (see Section 2's `next` return-to-destination flow). Visiting that URL — for any signed-in user, not just the host — fetches that one pod by id server-side (permitted by the existing `pods` SELECT RLS policy: `status = 'ACTIVE' OR user_id = auth.uid() OR is_accepted_pod_member(pods.id)`, so no new policy was needed) and auto-opens the **Pod Detail dialog** for it via `MatchFeed`'s new `initialSharedPod` prop. The URL only replaces back to the flat `/pods` (`router.replace`) once the viewer closes that dialog, not eagerly on load — replacing immediately would navigate away from the `/pods/[id]` route right as it rendered, remounting `MatchFeed` without `initialSharedPod` and closing the dialog right after it flashed open. Because a shared pod may not match the viewer's own browse filters, or may even be the viewer's own pod (which the feed query always excludes), it's tracked as a separate "pinned pod" rather than being injected into the visible feed list — it's still kept live (refetched alongside every other Match Feed refresh trigger: realtime events, focus/visibility resync, post-join/leave) so the dialog's Request to Join / Leave state never goes stale. If the linked pod no longer exists or isn't visible to the viewer (expired, matched, wrong id), the page just loads normally with no dialog and no error.

**My Pod Panel** (shown at the top of this screen only when the user has an ACTIVE pod):

- **Post-creation highlight:** Landing here via the `?highlight=own` query param set by the Search dialog's success redirect (Screen 2, above) plays a brief, soft pulsing glow (Framer Motion `boxShadow` animation, ~3.6s, mirrored ease-in-out) around the panel so a newly created pod is immediately obvious at the top of the feed instead of silently appearing. `OwnPodPanel` captures the flag into local state on mount, strips it from the URL via `router.replace` (so refreshing or navigating back doesn't replay it), and clears the highlight state once the animation finishes.
- Lists pending join requests (`pod_joins.status = 'PENDING'`) as requester profile cards (avatar, username, discord_handle) with **Accept** / **Reject** actions.
- Lists already-accepted members (`status = 'ACCEPTED'`) so the host can track pod fill progress against `max_players`. Discord's public API does not allow third-party apps to auto-create a group DM for arbitrary users (the `gdm.join` OAuth scope needed is restricted/deprecated for new apps), and a profile-by-ID deep link (`discord.com/users/<id>`) isn't a viable substitute either — Discord only resolves that for users you already share a server with or are friends with, so for two strangers matched by this app it just bounces to `/channels/@me` regardless of how correct the id is. The only mechanism that reliably works for strangers is Discord's own "Add Friend" search-by-username flow, so each Group Member row has its own **Copy Handle** button, plus a **Copy All Handles** button below the list, so the host can paste handles straight into that search. Once expanded, a **Copy Link** button sits alongside **Edit Pod** and **Mark as Matched** in the panel's action row, copying the pod's shareable `/pods/<pod.id>` URL — see the sharing note below.
- Accept/Reject actions are disabled once accepted joiners plus the host reach `max_players`.
- **Mark as Matched button:** host-only. Rather than immediately flipping the pod's `status`, it first opens a lightweight **warning dialog** (`ConfirmMarkMatchedDialog`) reminding the host to add everyone on Discord (via the Copy Handle buttons above) before continuing, since marking as matched removes the pod from the match feed for good. Only once the host clicks **Mark as Matched** inside that dialog does the pod's `status` actually become `MATCHED` (manual action — no automatic transition based on fill count).

**Match Feed** (below My Pod Panel, always shown): browsing UI for other users' active pods. It always filters by the viewer's own `playstyle_key` (from `profiles.preferred_playstyle`) **and by city scoping** (not user-adjustable, same as `playstyle_key` — see Section 6): Online pods always show regardless of city, while IRL pods are always restricted to ones whose snapshotted `city` matches the viewer's own `profiles.city`; a viewer with no city on file sees zero IRL pods (an inline hint on the screen points them to the Profile tab) but still sees every Online pod. On top of that sits an adjustable **`PodFilters`** bar (`/components/PodFilters.tsx`) rendered above the "Match Feed" heading, so it's the first browsing control on the whole screen. It renders as a single row of pill-shaped chips that **wraps onto additional lines rather than horizontally scrolling** once it runs out of width (no overflow scrollbar) — one chip per filter, each labeled with its current value or a neutral placeholder (e.g. "Date", "Format") when unset, and styled distinctly (filled) once active. Clicking a chip opens a small `Popover` anchored to it containing that filter's actual control; only one popover is open at a time. The filters are: **Game** (segmented buttons, defaulting to the viewer's `preferred_game`, with an "All Games" option — changing it resets Format and Power Bracket, mirroring `LfgDialog`'s `handleGameChange`), **Match Type** (All / IRL / Online), **Format** (chip only rendered once a specific game with more than one format is selected), **Date** (a clearable date picker matched against each pod's effective date — `scheduled_at`, falling back to `created_at` for pods with none), and **Power Bracket** (chip only rendered for games with `hasPowerTiers`; unlike Game, this does **not** default from `profiles.preferred_brackets` — it always starts unset/unrestricted, since that column reflects the viewer's last one-off LFG *search*, not a standing browse preference, and silently applying it here previously hid pods outside whatever bracket the viewer happened to search for last with no visible cause). A **Clear all** text link (shown only once at least one filter differs from the neutral "show everything" state) resets every filter, including Game, back to "All" (this never touches city scoping, which isn't part of `PodFiltersValue`). See Section 6. Each card is a summary only (host, format/type/location/city/brackets, accepted members, and the viewer's own join status badge if they've already requested) — it has no action button. Clicking anywhere on the card opens a **Pod Detail dialog** (`PodDetailDialog`) showing the full pod information — host identity, game/format/playstyle/match type/location/city, power brackets, `notes`, and the accepted-members list — plus the **Request to Join** action/status, which only ever appears in this dialog.

### Join Request Flow (Match Feed → Host Approval → Mutual Reveal)

1. A searcher browsing the Match Feed (Active Pods tab) sees an ACTIVE pod card showing the host's public info and any already-**ACCEPTED** members of the group/pod. Clicking the card opens the Pod Detail dialog described above.
2. Clicking **Request to Join** (from the detail dialog — the card itself has no join button) inserts a `pod_joins` row with `status = 'PENDING'`. The dialog then shows a "Pending" state to the searcher, also reflected as a status badge back on the card.
3. The host sees the new pending request appear in real time on their own Pod Panel (Active Pods tab), including the requester's profile. A `notifications` row is also inserted for the host (`JOIN_REQUEST`, via a database trigger — see Section 3), which the header `NotificationBell` surfaces as an unread badge plus, if the site is currently open, a native OS notification (via the browser `Notification` API, if permission was granted) and an in-app toast. Clicking the notification, toast, or its entry in the bell dropdown navigates the host to `/pods` — the Pod Panel there is where they act.
4. The host clicks **Accept** or **Reject**. On accept, `status` becomes `'ACCEPTED'` and the requester is added to the visible members list on both the host's panel and the Match Feed card; the requester now also sees the full accepted-members list (including discord handles) for that pod. On reject, `status` becomes `'REJECTED'` and the request is terminal (no re-request in this scope). Either way, a trigger inserts a `JOIN_ACCEPTED`/`JOIN_REJECTED` notification for the requester, surfaced the same way via `NotificationBell`.
5. At any point before the pod is matched, the searcher can back out from the **Pod Detail dialog** itself: if their request is still `PENDING` the button reads **Cancel Request**; once `ACCEPTED` it reads **Leave**. Both call the same `leavePod` action, which simply deletes their own `pod_joins` row (the unique `(pod_id, user_id)` constraint means they're free to request to join again afterwards, unlike a terminal `REJECTED` row). Leaving after being `ACCEPTED` triggers the host-facing `MEMBER_LEFT` notification described below; cancelling a still-`PENDING` request notifies no one.
6. When the host marks the pod as matched (see My Pod Panel above), every ACCEPTED member (not the host, who already knows) is shown a blocking **`MatchedDialog`** — telling them to head to Discord and warning that the pod's card is about to disappear from the match feed (since `MATCHED` pods no longer satisfy the `status = 'ACTIVE'` filter every match feed query uses). This is a dialog rather than a dismissable snackbar/notification specifically because it's the only cue those members get that the card will vanish, and deliberately isn't part of the `notifications` bell (see Section 3). Delivered via `MatchedPodWatcher`'s realtime subscription (a `pods` UPDATE handler checking `status = 'MATCHED'` plus an own-`pod_joins` lookup), subject to the same foreground-only caveat as the rest of that component (see Section 7).
7. Three further trigger-backed notification types round out the notification center (not tied to the join flow above): **`MEMBER_LEFT`** — the host is notified when an already-accepted member leaves their pod (cancelling a still-PENDING request notifies no one); **`POD_UPDATED`** — every accepted member is notified when the host edits their live pod's details via `updatePod` (Section 5's My Pod Panel "Edit Pod" button); and **`POD_DESTROYED`** — every accepted member is notified if the pod is cancelled (`cancelPod`) or silently replaced by the host starting a new search (`createPod`'s auto-expire of their existing `ACTIVE` pod) before it ever reached `MATCHED`. All three are fanned out to accepted members only — a still-`PENDING` requester is not considered to have really joined the group yet.

---

## 6. Match Feed Query Layout (`/components/MatchFeed.tsx`)

A component updating dynamically via real-time channel infrastructure. It takes the viewer's `profile` and their user id as props, plus owns its own **`PodFiltersValue`** state (`/components/PodFilters.tsx`, rendered as the wrapping chip-and-popover bar described in Section 5) driving the filter bar described in Section 5. That state's *initial* value only seeds `gameKey` from the viewer's profile (`profile.preferred_game`) so first load still browses meaningfully instead of showing every game at once — every other field, including `powerBrackets`, starts unset/unrestricted (see Section 5's Power Bracket note on why it deliberately does **not** seed from `profiles.preferred_brackets`); from there the user can broaden or narrow any field (including Game, down to "All Games") independently of `profiles`.

**Any pod the viewer has a live `pod_joins` row on (`PENDING` or `ACCEPTED`) is always included in the results, unconditionally** — fetched via a separate, unfiltered query (against `pod_joins` with `pods!inner(...)` embedded) run every time alongside the filtered query below, then merged in (de-duplicated by id) ahead of the filtered rows. This exists so a pod the viewer is actively part of can never disappear from their own feed just because they later change a browsing filter, or because it fails the always-on `playstyle_key`/city scoping described next — they still need to see it to track status, coordinate, or leave. That still-live join is itself scoped to `pods.status = 'ACTIVE'` and not yet expired (a `MATCHED` pod is deliberately excluded here too, same as everywhere else — it has its own dedicated `MatchedDialog` flow instead, see Section 5's Join Request Flow step 6).

The separate filtered query always excludes the viewer's own pod and expired rows, always filters by `playstyle_key` **and by city scoping** (city isn't part of `PodFiltersValue` — it's an always-on constraint like `playstyle_key`, not a user-adjustable filter): Online pods (`type = 'ONLINE'`) always pass regardless of city; IRL pods only pass if their snapshotted `city` equals the viewer's own `profiles.city`. If the viewer has no city on file, IRL pods are excluded from this filtered query outright (it's skipped entirely when `filters.matchType === "IRL"`, since there's nothing to compare against) while Online pods still show — the always-included joined pods above are unaffected by this and still show regardless. The query joins each pod's `pod_joins` so accepted members can be rendered on the card, and conditionally applies each remaining filter field (game/format as plain equality checks once set to something other than "All", power brackets as an array **overlap** check `&&` once at least one is selected). The **Date** filter isn't a plain column filter — since ONLINE pods have no `scheduled_at` — so it's applied client-side after the fetch, comparing each row's effective date (`scheduled_at ?? created_at`) against the selected day:

```typescript
// filters is PodFiltersValue — local component state seeded from the
// viewer's profile, not a fixed reflection of it.
const fetchActivePods = async (
  profile: Profile,
  currentUserId: string,
  filters: PodFiltersValue,
) => {
  // Always-included, unfiltered: pods the viewer has a live join on.
  const { data: joinedData } = await supabase
    .from("pod_joins")
    .select("pods!inner(*, profiles(*), pod_joins(*, profiles(*)))")
    .eq("user_id", currentUserId)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("pods.status", "ACTIVE")
    .gt("pods.expires_at", new Date().toISOString());
  const joinedPods = (joinedData ?? []).map((row) => row.pods);

  // City scoping short-circuit: an IRL-only view is impossible to satisfy
  // for a viewer with no city on file — joinedPods above are unaffected.
  let filteredRows = [];
  if (!(filters.matchType === "IRL" && !profile.city)) {
    let query = supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("playstyle_key", profile.preferred_playstyle)
      .eq("status", "ACTIVE")
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", currentUserId);

    // City scoping: Online pods always show; IRL pods are always
    // restricted to the viewer's own city, regardless of the Match Type
    // filter below.
    if (filters.matchType === "ONLINE") {
      query = query.eq("type", "ONLINE");
    } else if (filters.matchType === "IRL") {
      query = query.eq("type", "IRL").eq("city", profile.city);
    } else if (profile.city) {
      query = query.or(`type.eq.ONLINE,and(type.eq.IRL,city.eq.${profile.city})`);
    } else {
      query = query.eq("type", "ONLINE");
    }

    if (filters.gameKey !== "ALL") query = query.eq("game_key", filters.gameKey);
    if (filters.formatKey !== "ALL") query = query.eq("format_key", filters.formatKey);
    // Overlap match: any shared bracket between the selected brackets and
    // the pod's snapshotted power_tiers counts as a match.
    if (filters.powerBrackets.length) {
      query = query.overlaps("power_tiers", filters.powerBrackets);
    }

    const { data } = await query;
    filteredRows = data ?? [];
    if (filters.date) {
      filteredRows = filteredRows.filter((pod) =>
        isSameDay(new Date(pod.scheduled_at ?? pod.created_at), filters.date),
      );
    }
  }

  // Merge, joined pods first, de-duplicated against the filtered rows.
  const joinedIds = new Set(joinedPods.map((b) => b.id));
  setPods([...joinedPods, ...filteredRows.filter((b) => !joinedIds.has(b.id))]);
};
```

Only `pod_joins` rows with `status = 'ACCEPTED'` should be rendered as visible group members on each card; `PENDING`/`REJECTED` rows belonging to other users are not shown to searchers (RLS also restricts this — a searcher can only ever see their own join rows).

---

## 7. Progressive Web App Scope

This implementation pass targets **installability**, plus foreground join-request alerts:

- `app/manifest.ts` (Next.js built-in manifest convention) with name, short_name, theme/background colors, and 192x192 / 512x512 icons in `public/`.
- No service worker, no offline caching in this scope.
- **Notification center (not push):** `NotificationBell` (rendered in `TabBar`'s desktop navbar and a dedicated mobile top bar, since the mobile layout previously had no top header) reads/subscribes to the persisted `notifications` table (Section 3) and shows an unread-count badge, a dropdown of recent notifications, plus a native OS `Notification` and in-app toast when a new one arrives while the tab is open. Each notification row has its own dismiss (`X`) button (`deleteNotification`), and a **Clear all** link above the list (`deleteAllNotifications`) removes every notification for the user at once — both optimistically update local state before the server action resolves, and both are scoped to `recipient_id = auth.uid()` at the query level as well as by RLS (Section 3). `MatchedPodWatcher` (mounted app-wide in the `(app)` layout, formerly `JoinRequestNotifier`) separately shows a blocking `MatchedDialog` to accepted members when their pod is marked `MATCHED` (see Section 5's Join Request Flow, step 6). Both only fire while the PWA/tab process is actually running (foreground or backgrounded tab) — there is no service worker or server-triggered push involved, so nothing is delivered while the app is fully closed. The persisted `notifications` table means the bell's unread history survives reloads/relaunches even though live delivery is foreground-only.

---

## 8. Explicit Scope Exclusions

- No true push notifications (no service worker, no server-triggered delivery while the app is fully closed) and no offline/service-worker caching — see Section 7. The foreground `Notification`/snackbar join-request alert is not a substitute for push.
- No geolocation/proximity matching for IRL pods — `location_name` remains a free-text venue name, and city-level scoping (`profiles.city`/`pods.city`, Section 3) is a fixed list of exact-match slugs (`CITIES_CONFIG`, Section 4), not real geolocation or a distance/radius calculation.
- No pagination/infinite scroll on the Match Feed (MVP scale assumption).
- No re-request after a `REJECTED` join (terminal state for this pass).
- No per-search override screen separate from the dialog described in Section 5 — the LFG tab's Search dialog is the only place game settings are edited; the Profile tab holds identity fields (and sign-out) only.
- No automatic Discord group DM/channel creation — Discord's public API requires each participant to individually authorize the `gdm.join` OAuth scope (restricted/effectively deprecated for new apps), and a bot token cannot create or add arbitrary users to a group DM. There's also no reliable profile-by-ID deep link for two strangers (see Section 5's My Pod Panel). The Copy Handle / Copy All Handles buttons on the Group Members list are a manual-assist alternative, not real automation.

---

## 9. AI Agent Implementation Steps

```markdown
1. Mount foundational project libraries: `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, `lucide-react`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, and create `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server, cookie-based) using `@supabase/ssr`.
3. Execute the schema + RLS + Realtime SQL from Section 3 (`supabase/schema.sql`) in the Supabase SQL Editor.
4. Scaffold core database types directly matching properties outlined in Section 3.
5. Add `proxy.ts` for optimistic auth redirects and `/auth/callback/route.ts` for the Discord OAuth code exchange, per Section 2.
6. Build the `(app)` route group with a shared layout rendering `TabBar` (mobile bottom nav / desktop top navbar) around three routes: `/` (LFG), `/pods` (Active Pods), `/profile` (Profile). `/login` and `/auth/callback` stay outside this group.
7. Code the Profile screen (`/profile/page.tsx`) as an identity-only form (username, discord handle) plus a destructive Sign Out button, per Section 5.
8. Code the LFG tab's Search dialog (`LfgDialog`), pre-filled from the profile's last-used settings (game, format, match type, location, playstyle, multi-select power brackets, players needed), wiring the conditional Framer Motion bracket picker to the MTG check.
9. Build dynamic UI components leveraging Tailwind values inherited dynamically from `GAMES_CONFIG[game].themeColor`.
10. Implement the pod lifecycle as Server Actions: `createPod` takes the dialog's field values, persists them onto `profiles.preferred_*`, and snapshots them into a new `pods` row; `cancelPod`/`markPodMatched` operate by id. Implement the join-request flow (request/accept/reject), per Sections 5 and 6.
11. Bind real-time reactive data hooks matching data parameter strings directly into the Postgres engine layers.
12. Add `app/manifest.ts` and icons per Section 7.
13. Add the optional `notes` field to the Search dialog and `pods` table; add `PodDetailDialog` (opened by clicking a Match Feed card) per Section 5; add join-request alerting (native `Notification` + in-app snackbar on new join requests, mounted in the `(app)` layout) per Sections 5 and 7.
14. Add per-member **Copy Handle** / **Copy All Handles** buttons to the Group Members list, and a **Mark as Matched** button that opens `ConfirmMarkMatchedDialog` (a warning reminding the host to add everyone on Discord first) before `markPodMatched` actually runs, per Section 5 and Section 8's Discord API constraint.
15. Extend the join-request alerting with a `MatchedDialog`, shown to each accepted member (not the host) when their pod transitions to `MATCHED`, per Section 5's Join Request Flow step 6.
16. Add the persisted `notifications` table + `notification_type` enum + SECURITY DEFINER triggers (`notify_on_pod_join_insert/update/delete`, `notify_on_pod_update`, `notify_on_pod_destroyed`) per Section 3, covering join request / accepted / rejected / member-left / pod-updated / pod-destroyed. Build `NotificationBell` (unread badge, dropdown, toast + native notification on new inserts, realtime-subscribed with no server-side `filter` — RLS's `recipient_id = auth.uid()` check alone scopes each subscriber to their own rows, matching every other realtime subscription in this codebase) and mount it in `TabBar`'s desktop navbar plus a new mobile top bar. Narrow the former `JoinRequestNotifier` down to just the `MatchedDialog` watcher and rename it `MatchedPodWatcher`, since `NotificationBell` now owns the join-request/accepted/rejected alerts via the persisted table instead of listening to `pod_joins`/`pods` directly.
17. Add `profiles.city` (Section 3) plus the config-driven `constants/citiesConfig.ts` (`CITIES_CONFIG`/`CITY_MAP`, Section 4) and its `CitySelector` autocomplete on the Profile screen (Section 5). Add `pods.city`, snapshotted from `profiles.city` by `createPod`/`updatePod` the same way every other `preferred_*` field is snapshotted. Wire the always-on city scoping into `MatchFeed`'s query (Section 6): Online pods always show, IRL pods are restricted to the viewer's own city.
18. Add `pods.scheduled_at` (Section 3) and the Search dialog's Date/Time picker fields, required for IRL and validated in `validateStartSearchInput` (Section 5's Screen 2); display it (falling back to `created_at` for ONLINE pods) on Match Feed cards and in `PodDetailDialog`'s "When" row.
19. Add the adjustable `PodFilters` bar (`/components/PodFilters.tsx`) above the Match Feed — Game, Match Type, Format, Date, and Power Bracket, per Section 5's Screen 3 and Section 6 — seeded from the viewer's profile but independently adjustable, with a "Clear all" reset to the neutral `NEUTRAL_POD_FILTERS` state.
20. Add a **Cancel Request**/**Leave** action to `PodDetailDialog` for the searcher's own join (`leavePod`, Section 5's Join Request Flow step 5), and per-notification delete plus a "Clear all" action to `NotificationBell` (`deleteNotification`/`deleteAllNotifications`, Section 7), backed by the `notifications` DELETE RLS policy (Section 3).
21. Add `TutorialDialog` (a question-mark icon button opening a step-by-step "how it works" modal) next to `NotificationBell` in both of `TabBar`'s header rows, per Section 5's Navigation Shell.
22. Add shareable pod links, per Section 5's Screen 3: extract `/pods/page.tsx`'s own-pod fetch + layout into a shared `PodsView` server component, add the `/pods/[id]` dynamic route (this app's first) that fetches one pod by id and passes it down, add a **Copy Link** button to My Pod Panel, and add `MatchFeed`'s `initialSharedPod` prop / "pinned pod" handling so a linked pod auto-opens in `PodDetailDialog` and stays live-updated without being injected into the visible feed.
23. Thread a `next` return-to-destination through the login flow, per Section 2, so a logged-out visit to a shared pod link isn't lost: `proxy.ts` and `requireUser`/`requireProfile` (`src/lib/session.ts`) append `?next=<path>` onto their `/login` redirects; split `/login/page.tsx` into a Server Component reading `searchParams.next` and a client `LoginView` that carries it onto `signInWithOAuth`'s `redirectTo`; the existing `/auth/callback/route.ts` already redirected to `next` and needed no change.
24. Add the `sweep-inactive-active-pods` `pg_cron` job (`supabase/sql/inactive_pod_cleanup.sql`) per Section 3's Inactive Pod Cleanup subsection, deleting `ACTIVE` pods idle for 12+ hours and notifying the host plus any `ACCEPTED` members via a new `POD_EXPIRED_INACTIVITY` notification type. Add the type to `notification_type` and `src/types/database.ts`'s `NotificationType`, and wire its icon/copy into `NotificationBell`'s `TYPE_ICON`/`describeNotification`.
```

If you have questions at any point, ask me directly.

ALWAYS keep these SPECS.md up to date with new features and changes.
