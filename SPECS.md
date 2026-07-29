# Product Requirement Document (PRD) & Technical Specification

**Project:** Cross-TCG LFG Matchmaker (PodFinder PWA)
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
- **`LocaleSwitcher`** (`src/components/LocaleSwitcher.tsx`): an EN/FR segmented toggle, rendered inside the `SettingsDialog` modal (opened via a gear icon in `TabBar`, both the mobile top bar and desktop navbar, to the left of `TutorialDialog`/`NotificationBell`) and in the top-right corner of `/login` (which has no `TabBar`). It is no longer part of the Profile form.
- **Dates:** `formatPodWhen` (`src/lib/date.ts`) takes `(pod, locale, t)` and passes a `date-fns/locale` (`fr` or `undefined`) into every `format`/`formatDistanceToNowStrict` call, plus routes its wrapper phrases ("Starts in…", "Posted…", "Today, …") through `t()`. `NotificationBell`'s own relative-timestamp line does the same.
- **Not translated:** game names (`GAMES_CONFIG[key].name`, e.g. "Magic: The Gathering") and city labels (`CITIES_CONFIG`) are treated as proper nouns and stay as authored. Formats, power-bracket label, and playstyle options are translated via key-based lookups (`format.${key}`, `tier.powerBracket`, `playstyle.${key}`) resolved at render time, so `GAMES_CONFIG`'s shape didn't need to change. The `<title>`/`<meta description>` in the root layout's static `metadata` export remain English-only (SEO/crawler-facing, out of scope for this pass).

### Theming (Light / Dark)

- **Approach:** A single MUI theme factory, `createAppTheme(mode)` (`src/lib/mui/theme.ts`), builds a full palette (background, text, divider, the fixed emerald `primary` brand accent, error) plus component style overrides (`MuiButton`, `MuiToggleButtonGroup`/`MuiToggleButton`, `MuiOutlinedInput`, `MuiInputLabel`) from a single `PaletteMode`. Every override reads `theme.palette.*` tokens rather than hardcoding hex, so both modes share one definition and stay in sync automatically.
- **Mode storage:** A `pm_theme` cookie (`light` | `dark`, default **`light`**) — mirrors the locale cookie's device/browser-level storage approach rather than a `profiles` column.
- **Client wiring:** `ThemeModeProvider`/`useThemeMode()` (`src/lib/theme/ThemeModeContext.tsx`) expose `{ mode, setMode }` via React Context, mounted in the root layout inside `LocaleProvider` and around `ThemeRegistry`. `setMode` updates both React state and the `pm_theme` cookie directly (`document.cookie`), the same pattern as `setLocale`. `ThemeRegistry` (`src/components/ThemeRegistry.tsx`) consumes `useThemeMode()` and builds `createAppTheme(mode)` via `useMemo`, feeding it into MUI's `ThemeProvider`; `CssBaseline` (mounted alongside it) applies the resulting `background.default`/text colors to `<body>`, so the root layout no longer hardcodes a background class.
- **Server wiring:** `getServerThemeMode()` (`src/lib/theme/server.ts`) reads the cookie via `await cookies()` for the root layout's initial `ThemeModeProvider` value, so the first server-rendered paint already matches the stored preference (no flash-of-wrong-theme).
- **`ThemeToggle`** (`src/components/ThemeToggle.tsx`): a two-button pill `ToggleButtonGroup` (sun icon = light, moon icon = dark), rendered inside the `SettingsDialog` modal alongside `LocaleSwitcher`. Selecting a mode calls `setMode` directly — no confirmation step.
- **Scope:** The toggle is genuinely app-wide — the navbar/tab bar (`TabBar`), the LFG Search dialog (`LfgDialog`, which previously always forced a light appearance regardless of the rest of the app), and `PowerBracketPicker` all resolve their colors from the ambient theme rather than hardcoded values, so they switch together with the rest of the UI.

---

## 2. Authentication

- **Provider:** Discord OAuth via Supabase Auth (`supabase.auth.signInWithOAuth({ provider: 'discord' })`). No email/password or magic-link flow is supported.
- **Prerequisite (external, not code):** A Discord Developer Portal application (Client ID/Secret) registered as an OAuth provider in the Supabase project's Auth settings, with the Supabase-provided callback URL (`https://<project>.supabase.co/auth/v1/callback`) set as the Discord app's redirect URI.
- **Callback route:** `/auth/callback/route.ts` exchanges the OAuth `code` for a session (`exchangeCodeForSession`), then redirects to the `next` query param if present, falling back to `/`.
- **Discord handle auto-sync:** `discord_handle` is never hand-typed. At onboarding, `upsertProfile` (`src/app/actions/profile.ts`) derives it server-side from the user's Discord identity metadata (`user.user_metadata.full_name` ?? `.name` ?? `.preferred_username`) rather than trusting a submitted form field. On every subsequent login, the callback route re-derives the same value and `UPDATE`s it (and `avatar_url`) onto the existing `profiles` row — so if the user later renames themselves on Discord, this app's copy of their handle self-corrects on next sign-in with no action required. This exists because the handle only has value if it's the same string Discord's own "Add Friend" search resolves; a user-editable copy could silently drift from that and quietly break the whole Group Members hand-off (Section 5).
- **Route gating:**
  - `proxy.ts` (this Next.js version's renamed `middleware.ts`) performs a real, network-verified `auth.getUser()` check on every matched request and redirects unauthenticated requests to `/login` (except `/login` and `/auth/callback` themselves). It forwards the verified id downstream via the `x-lfg-user-id` request header (`TRUSTED_USER_ID_HEADER`), stripping any client-supplied value first so it can't be spoofed.
  - The real gate is server-side: each protected Server Component still independently confirms the session/profile rather than trusting proxy's check alone. `(app)/layout.tsx` reads the trusted header via `getTrustedUserId()` (no network call) purely to redirect-guard and pass `currentUserId` to `TabBar`. Pages/actions that need the authenticated user use `requireUser()`/`requireProfile()` (`src/lib/session.ts`), which re-verify via a fresh `auth.getUser()` call (deduped per-request by React `cache()`), redirecting to `/login` if no session or `/profile` if the session exists but onboarding hasn't been completed.
  - **`requireTrustedProfile()`** (`src/lib/session.ts`) is a cheaper variant of `requireProfile()` for the common case where a route only needs the user's id, not the full Supabase `user` object (email, `user_metadata`, etc.) — it trusts `getTrustedUserId()`'s header instead of paying for another `auth.getUser()` round-trip, since proxy already network-verified the same request. `/`, `/pods`, and `/history` (the three tab routes that never read `user.user_metadata`) use this; `/profile` still uses `requireUser()` because it needs Discord identity metadata for onboarding defaults, as does anything mutating state via a server action in `src/app/actions/`. This exists specifically to cut per-tab-click latency in `TabBar`'s navigation — see Section 5's Navigation Shell.
- **Return-to-destination after login (`next`):** so a logged-out visit to a deep link (e.g. a shared `/pods/<id>` pod link, Section 5) isn't lost, the originally-requested path is threaded end-to-end through the login round trip: `proxy.ts` appends `?next=<path>` onto its `/login` redirect; `requireUser`/`requireProfile` (`src/lib/session.ts`) accept an optional `path` argument from the calling page (e.g. `/pods/<id>`'s own page passes its own path) and do the same for their `/login` redirect, since proxy's check is only optimistic and the page-level gate is the one that actually runs; `/login`'s page reads `next` from its own `searchParams` (Server Component) and passes it down to the client `LoginView`, which appends it onto the `redirectTo` URL passed to `signInWithOAuth` (as `/auth/callback?next=<path>`); the callback route (above) then redirects there once the session is established. If the account has no `profiles` row yet, the onboarding redirect to `/profile` does not currently carry `next` through — a brand-new user finishes onboarding at the default destination rather than the original deep link.

### Legal (Terms of Service / Privacy Policy)

- **Routes:** `/terms` and `/privacy` (`src/app/terms/page.tsx`, `src/app/privacy/page.tsx`) are plain Server Components rendered outside the `(app)` route group, without `requireUser()`, and added to `PUBLIC_PATHS` in `src/proxy.ts` alongside `/login`/`/auth/callback` — so they're reachable both logged out and logged in. Each reads `getServerLocale()` and renders one of `TERMS_EN`/`TERMS_FR`/`PRIVACY_EN`/`PRIVACY_FR` (`src/lib/legal/content.ts`) via the shared `LegalPage` component.
- **Content storage is a deliberate exception to the i18n dictionary convention** (Section 1's Localization subsection): `src/lib/legal/content.ts` exports each locale's sections as `{ heading, body }` arrays directly, rather than flat `translate()`/`t()` keys — long-form legal prose doesn't fit the flat, short-string key convention used everywhere else, and keeping it in one dedicated content file makes it easy to swap in real reviewed legal text later without touching the dictionaries. Only the link labels/page titles (`legal.termsLink`, `legal.privacyLink`, `terms.title`, `privacy.title`) go through the normal dictionary.
- **Linking:** surfaced as passive links only (no forced acceptance checkbox) — inside `SettingsDialog` (see Navigation Shell above) and as a footer caption on `/login`'s `LoginView`, both `target="_blank"`.
- Current content is draft/placeholder copy (data collected, Discord-handle sharing between matched users, cookie usage, account-deletion rights, standard ToS boilerplate) meant to be reviewed by a lawyer before a real public launch, not final legal text.

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
    last_pod_created_at TIMESTAMP WITH TIME ZONE,        -- stamped by enforce_pod_creation_cooldown (supabase/sql/rate_limits.sql); drives the 15s pod-creation cooldown
    last_join_request_at TIMESTAMP WITH TIME ZONE,       -- stamped by enforce_join_request_cooldown (supabase/sql/rate_limits.sql); drives the 10s join-request cooldown
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
    matched_notified_at TIMESTAMP WITH TIME ZONE, -- set once this joiner has been shown MatchedDialog for this pod (supabase/sql/matched_notification_seen.sql); NULL means not yet shown
    CONSTRAINT unique_user_pod UNIQUE (pod_id, user_id)
);

-- 4. Notifications (persisted notification center backing the header bell)
CREATE TYPE notification_type AS ENUM (
    'JOIN_REQUEST', 'JOIN_ACCEPTED', 'JOIN_REJECTED', 'MEMBER_LEFT', 'REMOVED_FROM_POD', 'POD_UPDATED', 'POD_UPDATED_PENDING', 'POD_DESTROYED', 'POD_EXPIRED_INACTIVITY'
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

-- 5. Pod History ("Past Pods" tab, supabase/sql/pod_history.sql) — a durable
-- log that survives the Matched/Expired Pod Cleanup sweep below, since that
-- sweep hard-deletes the pods row (and its pod_joins) 24h after matched_at.
CREATE TABLE pod_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pod_id UUID NOT NULL,             -- not FK'd: the source pods row is deleted by the sweep; kept for reference only
    host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    game_key TEXT NOT NULL,
    format_key TEXT NOT NULL,
    playstyle_key TEXT NOT NULL,
    power_tiers INT[],
    type match_type NOT NULL,
    location_name TEXT,
    city TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    pod_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    matched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    members JSONB NOT NULL DEFAULT '[]'::jsonb, -- snapshot of every ACCEPTED pod_joins member at match time: [{ id, username, discord_handle, avatar_url }, ...]
    hidden_by UUID[] NOT NULL DEFAULT '{}', -- ids of viewers who deleted this entry from their own "Past Pods" list (Screen 4); the row itself is otherwise shared/untouched
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

> **Notifications have no `message` column.** Display copy is composed client-side (`NotificationBell`'s `describeNotification()`) from `type` plus the embedded `actor`/`pod` rows — this keeps copy easy to change/localize later without needing to backfill historical rows.
>
> **Rows are inserted exclusively by SECURITY DEFINER database triggers or the `pg_cron` cleanup jobs below, never by application code.** `notify_on_pod_join_insert/update/delete` (on `pod_joins`), `notify_on_pod_update` (on `pods`), `notify_pending_joiners_on_pod_update` (on `pods`, `supabase/sql/notify_pending_joiners_on_pod_update.sql`), and `notify_on_pod_destroyed` (on `pods`, `supabase/sql/notify_pod_destroyed.sql`) — all defined alongside the RLS policies in `supabase/schema.sql` (except the two split out into their own tracked `supabase/sql/` scripts) — cover, respectively: a new join request (host notified), a request accepted/rejected (joiner notified), an accepted member leaving (host notified), the host editing an already-live pod's details (every accepted member notified via `POD_UPDATED`, and separately every still-`PENDING` requester notified via `POD_UPDATED_PENDING` — a distinct type since the requester hasn't joined yet and the accepted-member copy would misstate that), and a pod being cancelled or replaced before it ever matched (every accepted member notified). The `sweep-inactive-active-pods` `pg_cron` job (`supabase/sql/inactive_pod_cleanup.sql`, see the Inactive Pod Cleanup subsection below) inserts the remaining `POD_EXPIRED_INACTIVITY` type directly, with `pod_id` left `NULL` since the pod is deleted in the same statement. Driving this from triggers/cron rather than the server actions in `src/app/actions/` means every current and future mutation path gets consistent notification coverage automatically, and lets `notifications` ship with **no client-facing INSERT policy at all** — a user can never fabricate a notification for someone else. A `MATCHED` status transition is deliberately **not** one of these types; it already has its own dedicated blocking `MatchedDialog` UX (via `MatchedPodWatcher`, see Section 5's Join Request Flow step 6), not a notification-center entry.

> **`pod_history` rows are likewise inserted exclusively by a SECURITY DEFINER trigger, never by application code.** `snapshot_pod_history` (`supabase/sql/pod_history.sql`) fires on every `pods` UPDATE and inserts a snapshot row only on the `ACTIVE -> MATCHED` transition — synchronously, so the row is captured well before the Matched/Expired Pod Cleanup sweep below can ever hard-delete the source `pods`/`pod_joins` rows. `EXPIRED`/cancelled pods are deliberately **not** logged here — a "Past Pod" is defined as one that actually reached a match, not an abandoned or cancelled search. `pod_history` ships with no client-facing INSERT/UPDATE/DELETE policy, same convention as `notifications`; the one mutation a viewer can trigger — deleting an entry from their own list — goes through a separate SECURITY DEFINER RPC, `hide_pod_history_entry`, described next to the SELECT policy below.

> **Abuse/spam guardrails are enforced at the database level, not just in the server actions** (`supabase/sql/rate_limits.sql`), so a direct API call can't bypass them either. `enforce_pod_creation_cooldown()` (a `BEFORE INSERT` trigger on `pods`) rejects a new pod with `RATE_LIMITED_POD_CREATE` if `profiles.last_pod_created_at` for that user is under 15 seconds old, then stamps it; `enforce_join_request_cooldown()` (a `BEFORE INSERT` trigger on `pod_joins`) does the same against `profiles.last_join_request_at` with a 10 second cooldown. Both are deliberately a simple last-action-timestamp check rather than a sliding-window counter table — no new infra, and it's enough to stop rapid-fire spam without needing to count requests over a rolling window. `createPod` (`src/app/actions/pods.ts`) and `requestJoin` (`src/app/actions/joins.ts`) catch these raised messages and surface a translated, friendly error instead of the raw Postgres exception.
>
> **Account deletion goes through a SECURITY DEFINER RPC, `delete_own_account()` (`supabase/sql/account_deletion.sql`), not a plain client-side delete.** Deleting from `auth.users` isn't something the anon/authenticated role can do directly, and this project has no service-role Supabase client set up anywhere, so — mirroring `hide_pod_history_entry`'s existing RPC convention — the function itself does the privileged work: it first anonymizes this user's entries inside *other* users' `pod_history.members` snapshots (username → "Deleted User", handle/avatar cleared) for any row they didn't host, since that JSONB snapshot isn't FK'd to `profiles` and wouldn't otherwise be touched by cascade deletes; then it deletes the `auth.users` row, which cascades through the existing FK chain above (`profiles` → `pods`, `pod_joins`, `notifications` as recipient, `pod_history` as host) exactly as it would for any other `ON DELETE CASCADE`. `deleteAccount()` (`src/app/actions/profile.ts`) calls this RPC, signs the (now-deleted) session out, and redirects to `/login`.

> **`get_games_played_count()` (`supabase/sql/pod_history.sql`) is a read-only SECURITY DEFINER RPC, not a plain `select` against `pod_history`.** It backs the History screen's lifetime "Games Played" stat (Section 5's Screen 4) and deliberately counts every row where the caller is `host_id` or in `members` — including ones the caller has since hidden from their own Past Pods list via `hide_pod_history_entry`. A plain client-side `select` would go through the SELECT policy above, which excludes hidden rows, silently shrinking an achievement-style counter just because someone decluttered their history view — bypassing RLS via `security definer` is what keeps those two concerns (what you see vs. what you've actually done) independent.
>
> **`mark_matched_notification_seen(p_pod_join_id)` (`supabase/sql/matched_notification_seen.sql`) lets a joiner stamp `pod_joins.matched_notified_at` on their own row, mirroring `hide_pod_history_entry`'s RPC convention** — the `pod_joins` UPDATE policy below is host-only (for Accept/Reject), so a joiner has no other way to persist "I've seen the MatchedDialog for this pod." Before this existed, `MatchedPodWatcher` tracked "already shown" purely in `localStorage`, keyed per-browser; on a new device that set started empty, and its on-mount check has no time bound (it just asks "am I an ACCEPTED member of a pod that is currently MATCHED"), so any pod matched at any point in the past — even before that device ever logged in — looked brand new and re-triggered the dialog. `matched_notified_at` makes "already shown" a durable, per-row, per-device-independent fact instead.

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
| `pod_history`   | SELECT          | Where (`host_id = auth.uid()` OR the caller's id appears in the `members` JSONB snapshot) AND the caller's id does NOT appear in `hidden_by`                                                                                                                                                 |
| `pod_history`   | INSERT / UPDATE / DELETE | No policy for `authenticated` at all — every row is created by the `snapshot_pod_history` SECURITY DEFINER trigger, and `hidden_by` is only ever mutated by the `hide_pod_history_entry` SECURITY DEFINER RPC (both bypass RLS); there is no other way to write to this table         |

### Realtime

Enable Supabase Realtime replication on the `pods`, `pod_joins`, and `notifications` tables to push instant matching feed, join-request, and notification-center updates. `pod_history` is intentionally **not** added to Realtime replication — it's a static, immutable historical log (see Screen 4 below), not a live feed.

> **`MatchFeed`, `OwnPodPanel`, and `LfgButton` share one Realtime channel instead of each opening their own.** `PodRealtimeProvider` (`src/components/PodRealtimeProvider.tsx`), mounted once around `{children}` in `src/app/(app)/layout.tsx`, opens a single unfiltered `postgres_changes` subscription on `pods` and `pod_joins` and exposes `usePodRealtime()` — `{ subscribePods, subscribePodJoins, notifyPodsChanged }` — backed by ref-held callback sets (not React state, so registering never re-renders the provider). Each of the three components registers its own existing refetch function as a callback instead of opening a channel of its own; this cuts per-tab Realtime channel count for these three from three down to one, with identical trigger conditions and identical per-component refetch behavior, since every pod mutation anywhere fans out to every open tab's channel(s) regardless of channel count. `NotificationBell` and `MatchedPodWatcher` still open their own channels (different tables/event shapes) and are unaffected — except that `MatchedPodWatcher` also calls the shared provider's `notifyPodsChanged()` (which just re-runs every registered callback, the same as a real `pods` event would) the moment it confirms a MATCHED transition through either its own realtime handler or its poll fallback. This closes a gap where a joiner's `MatchFeed` could keep showing a just-matched pod indefinitely: `PodRealtimeProvider`'s *own* `postgres_changes` delivery for that same UPDATE is a second, independent subscription and can silently fail to arrive (see the delivery-reliability note below) even when `MatchedPodWatcher`'s did — and unlike `NotificationBell`, `MatchFeed` has no poll fallback of its own to eventually self-heal, only a focus/visibility listener, which never fires for a viewer who was already sitting on a focused `/pods` tab watching for the `MatchedDialog` to appear. Unlike `MatchFeed`/`LfgButton` (whose focus/visibility-only fallback is enough since their content just sits there stale until next glanced at), `OwnPodPanel` also polls every 10 seconds while the tab is visible — a host waiting on a join request is typically staring at an already-focused `/pods` tab the whole time, so a focus/visibility listener alone would never fire (same rationale as `MatchedPodWatcher`'s poll fallback below). As with every other `postgres_changes` subscription in this codebase, `PodRealtimeProvider`'s subscription deliberately has **no `filter` param** — an earlier attempt at narrowing a subscription with `filter` was observed to silently break realtime delivery in this project (the row would exist and be visible on refetch, but the event itself never arrived at the open tab), so scoping is achieved only by reducing the number of duplicate subscriptions, never by filtering what a subscription listens to.

> **Supporting indexes (`supabase/sql/scale_indexes.sql`)** back the query patterns these realtime-triggered refetches (and `MatchedPodWatcher`'s 10-second poll fallback, see Section 7) already run constantly: `idx_pods_status_game_format_playstyle` on `pods(status, game_key, format_key, playstyle_key)` and `idx_pods_status_type_city` on `pods(status, type, city)` support the Match Feed's filtered query (the `playstyle_key` trailing column of the first index is no longer exercised by that query now that the feed doesn't filter on it, but the leading `status, game_key, format_key` columns still are), and `idx_pod_joins_user_status` on `pod_joins(user_id, status)` supports the user_id-only lookups `MatchedPodWatcher` and `LfgButton` run (the existing `unique_user_pod (pod_id, user_id)` index doesn't serve those efficiently since `pod_id` is its leading column). Purely additive — no behavior change, just keeps these already-frequent queries cheap as the active-pod set grows.

### Matched/Expired Pod Cleanup

An hourly `pg_cron` job (`sweep-matched-expired-pods`, defined in `supabase/sql/matched_pod_cleanup.sql`, applied directly in the Supabase SQL editor since this project has no tracked migrations) permanently deletes:

- `MATCHED` pods once `matched_at` is more than 24 hours old.
- `EXPIRED` pods once `expires_at` is more than 24 hours old.

The 24-hour grace window on `MATCHED` pods exists because `pod_joins` rows cascade-delete with their pod (`ON DELETE CASCADE`, above), and `MatchedPodWatcher` (Section 7) needs both rows to still exist in order to detect an accepted member's match and surface the `MatchedDialog` — an immediate delete on `markPodMatched` risks a member who wasn't actively polling missing that dialog entirely. Deleting a pod also cascades to its `notifications` rows, so any notification history tied to that pod (join requests, accept/reject, member-left) disappears with it once the sweep runs — this is accepted as intentional since `notifications` is a live inbox, not a permanent audit log. `MATCHED` pods are the one thing this sweep destroys that *does* have a durable record elsewhere: `snapshot_pod_history` (above) has already copied everything needed to render a "Past Pod" entry into `pod_history` at the moment of the `ACTIVE -> MATCHED` transition, hours before this sweep ever runs, so the Past Pods screen (Section 5) is unaffected by the deletion.

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

export const CITIES_CONFIG: CitySetting[] = [
  { key: "abbeville", label: "Abbeville" },
  { key: "ablon-sur-seine", label: "Ablon-sur-Seine" },
  // …
];

export const CITY_MAP: Record<string, CitySetting> = Object.fromEntries(
  CITIES_CONFIG.map((city) => [city.key, city]),
);
```

Scoped to a France launch, `CITIES_CONFIG` holds ~2,280 entries: every French commune with population ≥ 5,000 per INSEE's official commune dataset, covering essentially anywhere an IRL meetup would realistically happen. The list is machine-generated (not hand-typed) by `scripts/generate-cities-config.mjs`, which fetches `https://geo.api.gouv.fr/communes` (INSEE data via the French government's open geo API), filters by the population threshold, ASCII-slugifies each commune name into `key` (disambiguating same-named communes in different departments with a department-code suffix, e.g. `valence-26` / `valence-82`), and keeps the official `nom` as `label` — so spelling/accents are authoritative rather than manually verified. Re-run the script to regenerate the file if the threshold or dataset changes; adding a single one-off city still only needs a one-line addition, no schema/migration.

> **City stays a config-driven slug rather than free text, even at this scale.** Match Feed IRL scoping (Section 6) filters pods by exact equality on `city` (`city.eq.<value>`). A free-text city field would let typos, casing, or accent variants ("Aix en Provence" vs "Aix-en-Provence") silently split what should be the same city into different values, so two nearby players would never match — the constrained `Autocomplete` picker is what keeps the equality check reliable.

Because the option list is much larger than a hand-picked shortlist, `CitySelector.tsx` virtualizes the Autocomplete's listbox with `react-window` (a custom `slots.listbox` rendering only the visible rows) instead of rendering every `<li>` up front.

---

## 5. UI/UX Interface Layout & Screen Flows

### Navigation Shell

Four tabs, in this left-to-right order: **Active Pods**, **LFG**, **History**, **Profile**. `LFG` (`/`) is the default route. `Active Pods` (`/pods`) is first. `History` (`/history`, see Screen 4) sits between LFG and Profile. `Profile` (`/profile`) is last.

- **Mobile:** a fixed bottom tab bar, one icon + label per tab.
- **Desktop (`sm:` and up):** a top navbar with the app name on the left and the three tabs (icon + label) on the right, replacing the bottom bar.
- **Settings button (`SettingsDialog`):** a gear icon button rendered directly to the left of `TutorialDialog` in both the mobile top bar and the desktop navbar (same header row either way). Clicking it opens a modal containing the language preference (`LocaleSwitcher`), the light/dark theme toggle (`ThemeToggle`) — see Section 1's Theming subsection — and a small row of Terms of Service / Privacy Policy links (`target="_blank"`, see Section 2's Legal subsection below).
- **Tutorial button (`TutorialDialog`):** a question-mark icon button rendered directly to the left of `NotificationBell` in both the mobile top bar and the desktop navbar (same header row either way). Clicking it opens a modal walking through the app's core loop step by step (set up profile → start an LFG search → browse/get matched on Active Pods → host accepts join requests → notification bell → mark pod as matched → a closing "the more, the better" note on the network effect of inviting other players). The modal footer credits the app's creator with a link to `https://christopherkade.com/` (`target="_blank"`). Purely informational — no state, no server calls.
- **Locale switcher (`LocaleSwitcher`):** an EN/FR toggle. Rendered inside the `SettingsDialog` modal (see above) rather than inline in the header, and separately, top-right, on `/login` (which has no `TabBar`). See Section 1's Localization subsection.
- **Instant tab switching:** `TabBar` tracks a `pendingHref` local state, set the moment a tab is clicked and reconciled back to `usePathname()` once navigation actually lands, so the active-tab highlight flips immediately rather than waiting on the destination route's data. The real latency this masks is addressed three ways: `requireTrustedProfile()` (see the Authentication section) skips a redundant `auth.getUser()` round-trip on `/`, `/pods`, and `/history`; `next.config.ts` sets `experimental.staleTimes.dynamic = 30`, enabling Next's client Router Cache so revisiting any of the four tabs within 30 seconds of last loading it reuses the cached RSC payload with **no server request at all**; and, for `/`, `/pods`, and `/history` specifically, each screen's static chrome (the LFG button, the Match Feed's filter bar/title, the History title) now renders instantly on every navigation — cached or not — because the Server Component data those screens need is never `await`ed before rendering. Instead each Supabase query Promise is handed straight down, unresolved, to a Client Component that suspends on it via React's `use()` inside a `<Suspense>` boundary wrapping only the genuinely data-dependent subtree (see Screens 2-4 below), so only that part shows a loading skeleton while the rest of the screen is already interactive. This replaced an earlier route-level `loading.tsx`/full-page-skeleton attempt, which was tried and rejected as more distracting than helpful — the per-component Suspense split is scoped precisely to the parts that actually need to wait. `staleTimes` is safe globally (no per-route opt-out exists without the fork's broader `cacheComponents` system) because Pods and LFG already self-correct live via `PodRealtimeProvider`'s realtime subscriptions regardless of how stale a cached shell is, and History/Profile's data only changes via explicit user actions on those same screens.
- **Locked onboarding (`ProfileLockContext`):** A brand-new account (no `profiles` row yet, i.e. no username set) is locked to the Profile tab. `(app)/layout.tsx` fetches the profile once per request and wraps `TabBar` + the page content in `ProfileLockProvider` (`src/lib/ProfileLockContext.tsx`), exposing `usernameMissing` to both siblings. While `usernameMissing` is true, clicking any tab other than Profile is intercepted client-side via Next's `Link` `onNavigate` handler (`e.preventDefault()` — chosen over `onClick`'s `preventDefault` since `onNavigate` is scoped to actual SPA navigations and won't misfire on modifier-key/new-tab clicks), which also skips the `pendingHref` optimistic highlight so the blocked tab never flashes active. The blocked click sets a shared `blocked` flag that `ProfileForm` reads to show "Username is required." as `error`/`helperText` on the username field (clearing itself as soon as the user types), on top of an always-visible info `Alert` ("Pick a username to start using PodFinder.") shown whenever there's no profile yet. This is a client-side UX layer only — `requireProfile()`/`requireTrustedProfile()` (see the Authentication section) remain the authoritative server-side redirect-to-`/profile` guard for any route reached another way (direct URL, back button, etc.).

### Screen 1: Profile (`/profile/page.tsx`) — identity only

- **Standard Fields:** A text input for `username`, plus a read-only, disabled `discord_handle` field showing the value auto-synced from Discord OAuth identity metadata (see Section 2) — the user cannot edit it here.
- **New-account onboarding lock:** When there's no `profiles` row yet (`initialProfile` is `null`), an info `Alert` above the form reads "Pick a username to start using PodFinder." If the user tries to leave via the tab bar before saving one, the username field additionally shows "Username is required." as an inline `error`/`helperText` (cleared as soon as they start typing) — see the Navigation Shell's `ProfileLockContext` entry above for the client-side mechanics.
- **City Field (`CitySelector`):** A config-driven autocomplete (options from `CITIES_CONFIG`, see Section 4) selecting `profiles.city`. Optional — a user who only ever plays Online can leave it unset. This is what lets the Match Feed (Section 5's Screen 3, Section 6) automatically scope IRL pods to the viewer's own city while still always showing every Online pod. Whenever `city` is unset, an info `Alert` ("Add your city to create and join in-person pods near you.") is shown directly above `CitySelector`, explaining why it matters before the user hits the IRL-pod block described in Screen 2.
- Saving submits `username`/`city` in one upsert to `profiles` (see Section 3), with `discord_handle` recomputed server-side from `user.user_metadata` rather than read from the submitted form; the `preferred_*` search-setting columns are left untouched by this form (they're edited via the LFG Search dialog instead, see Screen 2). Language preference is not part of this form — it's a device-level display setting edited via the `SettingsDialog` (see above), not account data.
- **Sign Out:** A destructive-styled (red) button below the profile form that calls `supabase.auth.signOut()` and redirects to `/login`.
- **Delete Account:** A second destructive-styled button below Sign Out, opening `DeleteAccountDialog` (a motion-overlay confirm dialog, same shape as `ConfirmMarkMatchedDialog` but with a red confirm button) warning that the action is permanent. Confirming calls the `deleteAccount` server action (`src/app/actions/profile.ts`), which runs the `delete_own_account()` RPC (Section 3), signs out, and redirects to `/login`.

### Screen 2: LFG (`/page.tsx`) — action button + Search dialog

The LFG tab's base state renders **only the pulsing action button** (plus a small line summarizing the last-used game/format/match type read from the profile, and any inline error). There is no always-visible settings UI on this screen.

`/page.tsx` only awaits `requireTrustedProfile()` before rendering `LfgButton` — it deliberately does not fetch the viewer's own active pod / pending join server-side (it used to, sequentially, which meant the button waited on two extra round-trips it doesn't need for a meaningful first paint). `LfgButton` renders everything needed for its base state from `profile` alone, then fetches its own pod/join status itself on mount via the same `fetchOwnPod`/`fetchHasActiveJoin` functions it already uses for realtime resync. If the viewer already has an active search, this means a brief self-correcting flash (idle button → pulsing "searching" state) rather than the correct state on the very first frame — accepted as a minor cosmetic tradeoff for not blocking the button's render at all.

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
   - **Match Type Switch:** Segmented toggle between **IRL** and **ONLINE**. Selecting **IRL** while the viewer's `profiles.city` is unset shows a warning `Alert` ("You need to set your city on your profile before creating an in-person pod.") right below the switch and blocks submission (`canSubmit` requires a non-null city whenever Match Type is IRL) — unlike Location/Date/Time below, there's no field in this dialog that can fix it, so the message points the user back to the Profile screen. `validateStartSearchInput` (used by both `createPod` and `updatePod`) re-checks this server-side and returns `errors.cityRequired` if bypassed.
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

The screen's own-pod fetch + layout is shared between two routes via `PodsView` (`/app/(app)/pods/PodsView.tsx`, a server component): the flat `/pods` route above, and `/pods/[id]` — this app's first dynamic route segment — used for shareable pod links (see below). `PodsView` doesn't `await` any of its three Supabase queries (own pod, shared pod, initial feed rows) — it hands each Promise straight down, unresolved, to a Client Component that suspends on it via `use()`. `MatchFeed`'s filter bar and "Match Feed" title (which need only the already-available `profile`, not these queries) render immediately; the actual feed content is owned by a separate child, `MatchFeedList`, wrapped in its own `<Suspense>` showing a card-shaped skeleton until the data resolves. `OwnPodPanel` similarly suspends on its own promise inside a `<Suspense fallback={null}>` — since it already renders nothing until a pod exists, an empty fallback is visually identical to "no active pod," just arriving a beat later instead of blocking the page.

**Sharing a pod:** every ACTIVE pod has a stable link, `/pods/<pod.id>`. My Pod Panel (below) has a **Copy Link** button, alongside its Add on Discord buttons, that copies `<origin>/pods/<pod.id>` to the clipboard. A logged-out visitor is sent to `/login` first and returned to this same URL after completing Discord OAuth (see Section 2's `next` return-to-destination flow). Visiting that URL — for any signed-in user, not just the host — fetches that one pod by id server-side (permitted by the existing `pods` SELECT RLS policy: `status = 'ACTIVE' OR user_id = auth.uid() OR is_accepted_pod_member(pods.id)`, so no new policy was needed) and auto-opens the **Pod Detail dialog** for it via a promise threaded down through `MatchFeed` into `MatchFeedList`'s `initialSharedPodPromise`. The URL only replaces back to the flat `/pods` (`router.replace`) once the viewer closes that dialog, not eagerly on load — replacing immediately would navigate away from the `/pods/[id]` route right as it rendered, remounting `MatchFeedList` without that shared-pod data and closing the dialog right after it flashed open. Because a shared pod may not match the viewer's own browse filters, or may even be the viewer's own pod (which the feed query always excludes), it's tracked as a separate "pinned pod" rather than being injected into the visible feed list — it's still kept live (refetched alongside every other Match Feed refresh trigger: realtime events, focus/visibility resync, post-join/leave) so the dialog's Request to Join / Leave state never goes stale. If the linked pod no longer exists or isn't visible to the viewer (expired, matched, wrong id), the page just loads normally with no dialog and no error.

**My Pod Panel** (shown at the top of this screen only when the user has an ACTIVE pod):

- **Post-creation highlight:** Landing here via the `?highlight=own` query param set by the Search dialog's success redirect (Screen 2, above) plays a brief, soft pulsing glow (Framer Motion `boxShadow` animation, ~3.6s, mirrored ease-in-out) around the panel so a newly created pod is immediately obvious at the top of the feed instead of silently appearing. `OwnPodPanel` captures the flag into local state on mount, strips it from the URL via `router.replace` (so refreshing or navigating back doesn't replay it), and clears the highlight state once the animation finishes.
- Lists pending join requests (`pod_joins.status = 'PENDING'`) as requester profile cards (avatar, username, discord_handle) with **Accept** / **Reject** actions. Kept live via realtime plus a focus/visibility resync and a 10-second poll fallback (Section 3) — the poll matters here specifically because a host is typically watching this list on an already-focused tab rather than switching back to it.
- Lists already-accepted members (`status = 'ACCEPTED'`) so the host can track pod fill progress against `max_players`. Discord's public API does not allow third-party apps to auto-create a group DM for arbitrary users (the `gdm.join` OAuth scope needed is restricted/deprecated for new apps), and a profile-by-ID deep link (`discord.com/users/<id>`) isn't a viable substitute either — Discord only resolves that for users you already share a server with or are friends with, so for two strangers matched by this app it just bounces to `/channels/@me` regardless of how correct the id is. The only mechanism that reliably works for strangers is Discord's own "Add Friend" search-by-username flow, so each Group Member row has its own **Add on Discord** button (`openDiscordAddFriend`, `src/lib/discord.ts`) that copies the (now auto-synced, never-mistyped — see Section 2) handle to the clipboard *and* opens Discord to the Friends/DMs screen in the same tap, preferring the `discord://` desktop/mobile app URI and falling back to the web client if the app doesn't intercept it — collapsing "copy, then find and switch to Discord" into one action. A **Copy All Handles** button below the list remains copy-only (bulk, so there's no single Discord screen to open to). Once expanded, a **Copy Link** button sits alongside **Edit Pod** and **Mark as Matched** in the panel's action row, copying the pod's shareable `/pods/<pod.id>` URL — see the sharing note below.
- Accept/Reject actions are disabled once accepted joiners plus the host reach `max_players`.
- **Mark as Matched button:** host-only. Rather than immediately flipping the pod's `status`, it first opens a lightweight **warning dialog** (`ConfirmMarkMatchedDialog`) reminding the host to add everyone on Discord (via the Add on Discord buttons above) before continuing, since marking as matched removes the pod from the match feed for good. Only once the host clicks **Mark as Matched** inside that dialog does the pod's `status` actually become `MATCHED` (manual action — no automatic transition based on fill count).

**Match Feed** (below My Pod Panel, always shown): browsing UI for other users' active pods. It always applies **city scoping** (not user-adjustable — see Section 6): Online pods always show regardless of city, while IRL pods are always restricted to ones whose snapshotted `city` matches the viewer's own `profiles.city`; a viewer with no city on file sees zero IRL pods (an inline hint on the screen points them to the Profile tab) but still sees every Online pod. `playstyle_key` is **not** a feed filter — a pod's playstyle is shown on its card and in `PodDetailDialog`, but the feed shows pods of every playstyle regardless of the viewer's own `profiles.preferred_playstyle`, same as any other field with no corresponding `PodFilters` chip. The "Match Feed" heading has a **Refresh** icon button (`RefreshButton`, shared with the History screen — see Screen 4) directly beside it. Since the button lives in `MatchFeed` (the instant-rendering shell) while the actual fetch logic lives in `MatchFeedList` (the child that suspends on the feed data — see above), it calls the child's `fetchActivePods(filters)` via an imperative `refetch()` exposed through a ref rather than calling it directly — a manual, filter-respecting escape hatch on top of the automatic realtime healing, and a hedge against the Router Cache above possibly serving a stale initial shell. The icon spins while the refetch is in flight and the button stays disabled for a couple seconds after it resolves, so rapid clicking can't fire a burst of refetches. On top of that sits an adjustable **`PodFilters`** bar (`/components/PodFilters.tsx`) rendered above the "Match Feed" heading, so it's the first browsing control on the whole screen. It renders as a single row of pill-shaped chips that **wraps onto additional lines rather than horizontally scrolling** once it runs out of width (no overflow scrollbar) — one chip per filter, each labeled with its current value or a neutral placeholder (e.g. "Date", "Format") when unset, and styled distinctly (filled) once active. Clicking a chip opens a small `Popover` anchored to it containing that filter's actual control; only one popover is open at a time. The filters are: **Game** (segmented buttons, defaulting to the viewer's `preferred_game`, with an "All Games" option — changing it resets Format and Power Bracket, mirroring `LfgDialog`'s `handleGameChange`), **Match Type** (All / IRL / Online), **Format** (chip only rendered once a specific game with more than one format is selected), **Date** (a clearable date picker matched against each pod's effective date — `scheduled_at`, falling back to `created_at` for pods with none), and **Power Bracket** (chip only rendered for games with `hasPowerTiers`; unlike Game, this does **not** default from `profiles.preferred_brackets` — it always starts unset/unrestricted, since that column reflects the viewer's last one-off LFG *search*, not a standing browse preference, and silently applying it here previously hid pods outside whatever bracket the viewer happened to search for last with no visible cause). A **Clear all** text link (shown only once at least one filter differs from the neutral "show everything" state) resets every filter, including Game, back to "All" (this never touches city scoping, which isn't part of `PodFiltersValue`). See Section 6. Each card is a summary only (host, format/type/location/city/brackets, accepted members, and the viewer's own join status badge if they've already requested) — it has no action button. Clicking anywhere on the card opens a **Pod Detail dialog** (`PodDetailDialog`) showing the full pod information — host identity, game/format/playstyle/match type/location/city, power brackets, `notes`, and the accepted-members list — plus the **Request to Join** action/status, which only ever appears in this dialog.

### Screen 4: History (`/history/page.tsx`) — "Past Pods" log

The third tab, between LFG and Profile. Directly under the screen's heading, a single read-only "Games played: N" line — fetched via the `get_games_played_count()` RPC (Section 3) rather than counting the list below, so it reflects every `MATCHED` pod the viewer has ever hosted or played in, including ones since deleted from this list (see "Deleting an entry" below); this is meant to read as a lifetime achievement stat, not a live count of what's currently visible. Below that, a list of every pod the viewer hosted or was an accepted member of that reached `MATCHED` — the one durable trace of a pod that survives the Matched/Expired Pod Cleanup sweep (Section 3), since `snapshot_pod_history` copies everything needed to render an entry into `pod_history` the moment the pod transitions to `MATCHED`. The query (`/app/(app)/history/page.tsx`: `.from("pod_history").select("*, host:profiles!host_id(...)").order("matched_at", { ascending: false }).limit(50)` — RLS alone scopes results to rows the viewer is the host of, appears in the `members` snapshot of, and hasn't hidden for themselves, no further filter needed) is **not** awaited by the page — like `/pods`, its Promise (and the `get_games_played_count()` RPC's) is handed straight down, unresolved, to a Client Component that suspends on it via `use()`. `HistoryList` owns the screen's header block (title + **Refresh** button) and renders it instantly; the "Games played" line and the entries list themselves are owned by a separate child, `HistoryEntriesList`, wrapped in its own `<Suspense>` showing a row-shaped skeleton until both resolve — mirroring the same shell/child split `MatchFeed`/`MatchFeedList` use on Screen 3. No realtime subscription (entries are immutable once inserted, aside from that per-viewer hide) and no pagination control, consistent with the app's MVP-scale no-pagination convention elsewhere. The title has a **Refresh** icon button (`RefreshButton`, shared with the Match Feed heading) beside it that calls `HistoryEntriesList`'s `refetch()` (exposed via ref, same pattern as `MatchFeedList`), which re-runs both the `pod_history` query and the games-played RPC directly via the Supabase client and replaces both in local state — needed because, unlike Pods/LFG, this screen has no realtime correction, and `pod_history` rows are written by a database trigger (`snapshot_pod_history`, Section 3) that Next's own action-based cache revalidation has no visibility into, so a newly matched pod otherwise wouldn't appear here until the Router Cache entry (Navigation Shell, above) naturally expires.

Each entry renders as a card: game/format/playstyle, match type + location/city, the matched date (via `formatPodWhen`, same helper used elsewhere), and the full roster (host, labeled as such, plus every accepted member) with avatars. An empty state renders when the viewer has no `MATCHED` pods yet. Cancelled/expired pods are deliberately excluded — only pods that actually reached a match are logged.

**Deleting an entry:** each card has a trash-icon button (top right) that removes it from the viewer's own list. Since one `pod_history` row is shared by the host and every accepted member, this can't be a real `DELETE` — that would erase the entry for everyone else too. Instead it's a per-viewer soft-delete: `deletePodHistoryEntry` (`src/app/actions/history.ts`) calls the `hide_pod_history_entry` SECURITY DEFINER RPC (`supabase/sql/pod_history.sql`), which appends the caller's id onto that row's `hidden_by uuid[]` column; the SELECT RLS policy excludes any row containing the caller's own id, so the entry disappears from their view only, leaving the host's and other members' copies of the same history intact. `HistoryList` removes the card from local state immediately (same optimistic-update pattern as `NotificationBell`'s delete), firing the action without waiting on it.

### Join Request Flow (Match Feed → Host Approval → Mutual Reveal)

1. A searcher browsing the Match Feed (Active Pods tab) sees an ACTIVE pod card showing the host's public info and any already-**ACCEPTED** members of the group/pod. Clicking the card opens the Pod Detail dialog described above.
2. Clicking **Request to Join** (from the detail dialog — the card itself has no join button) inserts a `pod_joins` row with `status = 'PENDING'`. The dialog then shows a "Pending" state to the searcher, also reflected as a status badge back on the card. `requestJoin` (`src/app/actions/joins.ts`) rejects the request server-side if the target pod isn't `ACTIVE`, if it's the searcher's own pod, if the searcher currently hosts a different `ACTIVE` pod of their own (`errors.alreadyHostingPod` — the mirror image of `createPod`'s "already in a group" block described above: you can't be searching and hosting at the same time), or if the group is already full.
3. The host sees the new pending request appear in real time on their own Pod Panel (Active Pods tab), including the requester's profile. A `notifications` row is also inserted for the host (`JOIN_REQUEST`, via a database trigger — see Section 3), which the header `NotificationBell` surfaces as an unread badge plus, if the site is currently open, a native OS notification (via the browser `Notification` API, if permission was granted), an in-app toast, and a short chime (`public/sounds/notification.wav`, played at volume 0.5 via the same clone-per-play `Audio` pattern as `LfgButton`'s click sound, so overlapping notifications don't cut each other off). Clicking the notification, toast, or its entry in the bell dropdown navigates the host to `/pods` — the Pod Panel there is where they act.
4. The host clicks **Accept** or **Reject**. On accept, `status` becomes `'ACCEPTED'` and the requester is added to the visible members list on both the host's panel and the Match Feed card; the requester now also sees the full accepted-members list (including discord handles) for that pod. On reject, `status` becomes `'REJECTED'` and the request is terminal (no re-request in this scope). Either way, a trigger inserts a `JOIN_ACCEPTED`/`JOIN_REJECTED` notification for the requester, surfaced the same way via `NotificationBell`.
5. At any point before the pod is matched, the searcher can back out from the **Pod Detail dialog** itself: if their request is still `PENDING` the button reads **Cancel Request**; once `ACCEPTED` it reads **Leave**. Both call the same `leavePod` action, which simply deletes their own `pod_joins` row (the unique `(pod_id, user_id)` constraint means they're free to request to join again afterwards, unlike a terminal `REJECTED` row). Leaving after being `ACCEPTED` triggers the host-facing `MEMBER_LEFT` notification described below; cancelling a still-`PENDING` request notifies no one.
6. When the host marks the pod as matched (see My Pod Panel above), every ACCEPTED member (not the host, who already knows) is shown a blocking **`MatchedDialog`** — telling them to head to Discord and warning that the pod's card is about to disappear from the match feed (since `MATCHED` pods no longer satisfy the `status = 'ACTIVE'` filter every match feed query uses). This is a dialog rather than a dismissable snackbar/notification specifically because it's the only cue those members get that the card will vanish, and deliberately isn't part of the `notifications` bell (see Section 3). Delivered via `MatchedPodWatcher`'s realtime subscription (a `pods` UPDATE handler checking `status = 'MATCHED'` plus an own-`pod_joins` lookup) and its poll fallback, both gated on `pod_joins.matched_notified_at IS NULL` and immediately stamping it via the `mark_matched_notification_seen` RPC (Section 3) so the dialog fires exactly once per matched pod, durably, regardless of device — subject to the same foreground-only caveat as the rest of that component (see Section 7). The instant either path fires the dialog, it also calls `PodRealtimeProvider`'s `notifyPodsChanged()` (Section 7), forcing that member's own `MatchFeed`/`OwnPodPanel`/`LfgButton` to refetch immediately rather than depending on `PodRealtimeProvider`'s own, separately-unreliable realtime delivery of the same `pods` UPDATE — so the just-matched card is already gone from the feed by the time the member dismisses the dialog.
7. Three further trigger-backed notification types round out the notification center (not tied to the join flow above): **`MEMBER_LEFT`** — the host is notified when an already-accepted member leaves their pod (cancelling a still-PENDING request notifies no one); **`POD_UPDATED`**/**`POD_UPDATED_PENDING`** — when the host edits their live pod's details via `updatePod` (Section 5's My Pod Panel "Edit Pod" button), every accepted member is notified (`POD_UPDATED`) and, separately, every still-`PENDING` requester is also notified (`POD_UPDATED_PENDING`, `notify_pending_joiners_on_pod_update` in `supabase/sql/notify_pending_joiners_on_pod_update.sql`) — an unaccepted request can still be swayed by a changed schedule, format, or player count, so unlike `MEMBER_LEFT`/`POD_DESTROYED` this one deliberately does reach pending requesters, just with different copy than the accepted-member version; and **`POD_DESTROYED`** — every accepted member is notified if the pod is cancelled (`cancelPod`) or silently replaced by the host starting a new search (`createPod`'s auto-expire of their existing `ACTIVE` pod) before it ever reached `MATCHED`. `MEMBER_LEFT`/`POD_DESTROYED` are fanned out to accepted members only — a still-`PENDING` requester is not considered to have really joined the group yet for those.

### Global 404 (`src/app/not-found.tsx`)

A root `not-found.tsx` (client component, since it needs `useTranslation`) renders for any URL that doesn't match a route — Next.js uses it automatically for both unmatched paths and explicit `notFound()` calls, no `global-not-found`/`globalNotFound` flag needed since the app has a single root layout (`src/app/layout.tsx`). Shows the `PodFinder_Mascot_Confused.png` mascot, a "Looks like you're lost" title/description (`notFound.title`/`notFound.description`), and a **Back to PodFinder** button (`notFound.cta`) linking to `/`. Styled the same as `LoginView` (MUI `Box`/`Typography`/`Button` on theme tokens, no custom colors). Because `proxy.ts` (Section 2) redirects any unauthenticated request to a non-public path straight to `/login` before Next's router resolves it, this page is only ever reached by an authenticated user, or an unauthenticated one hitting a nonexistent sub-path under a `PUBLIC_PATHS` prefix (`/login`, `/auth/callback`, `/terms`, `/privacy`) — a mistyped path elsewhere sends the visitor to login instead of this page.

---

## 6. Match Feed Query Layout (`/components/MatchFeed.tsx`)

A component updating dynamically via real-time channel infrastructure. It takes the viewer's `profile` and their user id as props, plus owns its own **`PodFiltersValue`** state (`/components/PodFilters.tsx`, rendered as the wrapping chip-and-popover bar described in Section 5) driving the filter bar described in Section 5. That state's *initial* value only seeds `gameKey` from the viewer's profile (`profile.preferred_game`) so first load still browses meaningfully instead of showing every game at once — every other field, including `powerBrackets`, starts unset/unrestricted (see Section 5's Power Bracket note on why it deliberately does **not** seed from `profiles.preferred_brackets`); from there the user can broaden or narrow any field (including Game, down to "All Games") independently of `profiles`.

**Any pod the viewer has a live `pod_joins` row on (`PENDING` or `ACCEPTED`) is always included in the results, unconditionally** — fetched via a separate, unfiltered query (against `pod_joins` with `pods!inner(...)` embedded) run every time alongside the filtered query below, then merged in (de-duplicated by id) ahead of the filtered rows. This exists so a pod the viewer is actively part of can never disappear from their own feed just because they later change a browsing filter, or because it fails the always-on city scoping described next — they still need to see it to track status, coordinate, or leave. That still-live join is itself scoped to `pods.status = 'ACTIVE'` and not yet expired (a `MATCHED` pod is deliberately excluded here too, same as everywhere else — it has its own dedicated `MatchedDialog` flow instead, see Section 5's Join Request Flow step 6).

The separate filtered query always excludes the viewer's own pod and expired rows, and always applies **city scoping** (city isn't part of `PodFiltersValue` — it's an always-on constraint, not a user-adjustable filter): Online pods (`type = 'ONLINE'`) always pass regardless of city; IRL pods only pass if their snapshotted `city` equals the viewer's own `profiles.city`. `playstyle_key` is not filtered on at all — a pod's playstyle has no corresponding `PodFilters` control, so the feed shows every playstyle regardless of the viewer's own `profiles.preferred_playstyle`. If the viewer has no city on file, IRL pods are excluded from this filtered query outright (it's skipped entirely when `filters.matchType === "IRL"`, since there's nothing to compare against) while Online pods still show — the always-included joined pods above are unaffected by this and still show regardless. The query joins each pod's `pod_joins` so accepted members can be rendered on the card, and conditionally applies each remaining filter field (game/format as plain equality checks once set to something other than "All", power brackets as an array **overlap** check `&&` once at least one is selected). The **Date** filter isn't a plain column filter — since ONLINE pods have no `scheduled_at` — so it's applied client-side after the fetch, comparing each row's effective date (`scheduled_at ?? created_at`) against the selected day:

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
- **Notification center (not push):** `NotificationBell` (rendered in `TabBar`'s desktop navbar and a dedicated mobile top bar, since the mobile layout previously had no top header) reads/subscribes to the persisted `notifications` table (Section 3) and shows an unread-count badge, a dropdown of recent notifications, plus a native OS `Notification`, in-app toast, and chime (`public/sounds/notification.wav`) when a new one arrives while the tab is open. Each notification row has its own dismiss (`X`) button (`deleteNotification`), and a **Clear all** link above the list (`deleteAllNotifications`) removes every notification for the user at once — both optimistically update local state before the server action resolves, and both are scoped to `recipient_id = auth.uid()` at the query level as well as by RLS (Section 3). `MatchedPodWatcher` (mounted app-wide in the `(app)` layout, formerly `JoinRequestNotifier`) separately shows a blocking `MatchedDialog` to accepted members when their pod is marked `MATCHED` (see Section 5's Join Request Flow, step 6), and `OwnPodPanel`'s pending-requests list (Section 5, Screen 3) keeps itself live with the same realtime-plus-poll approach. All three only fire while the PWA/tab process is actually running (foreground or backgrounded tab) — there is no service worker or server-triggered push involved, so nothing is delivered while the app is fully closed. The persisted `notifications` table means the bell's unread history survives reloads/relaunches even though live delivery is foreground-only.

---

## 8. Explicit Scope Exclusions

- No true push notifications (no service worker, no server-triggered delivery while the app is fully closed) and no offline/service-worker caching — see Section 7. The foreground `Notification`/snackbar join-request alert is not a substitute for push.
- No geolocation/proximity matching for IRL pods — `location_name` remains a free-text venue name, and city-level scoping (`profiles.city`/`pods.city`, Section 3) is a fixed list of exact-match slugs (`CITIES_CONFIG`, Section 4), not real geolocation or a distance/radius calculation.
- No pagination/infinite scroll on the Match Feed (MVP scale assumption).
- No re-request after a `REJECTED` join (terminal state for this pass).
- No per-search override screen separate from the dialog described in Section 5 — the LFG tab's Search dialog is the only place game settings are edited; the Profile tab holds identity fields (and sign-out) only.
- No automatic Discord group DM/channel creation — Discord's public API requires each participant to individually authorize the `gdm.join` OAuth scope (restricted/effectively deprecated for new apps), and a bot token cannot create or add arbitrary users to a group DM. There's also no reliable profile-by-ID deep link for two strangers (see Section 5's My Pod Panel). The Add on Discord / Copy All Handles buttons on the Group Members list are a manual-assist alternative (auto-synced handle plus a one-tap clipboard-copy-and-open-Discord shortcut), not real automation — the user still has to paste and send the friend request themselves once Discord is open.

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
25. Add the app-wide light/dark theme toggle, per Section 1's Theming subsection: `createAppTheme(mode)` (`src/lib/mui/theme.ts`) already supported both modes, so add the `pm_theme` cookie infra (`src/lib/theme/index.ts`, `server.ts`, `ThemeModeContext.tsx`, mirroring the locale cookie pattern), make `ThemeRegistry` build its MUI theme from `useThemeMode()` instead of a static dark theme, and add `ThemeToggle` (sun/moon `ToggleButtonGroup`) to `SettingsDialog`. Remove `LfgDialog`'s forced light-only `ThemeProvider` wrap and convert its (and `TabBar`'s and `PowerBracketPicker`'s) hardcoded Tailwind/hex colors to theme tokens so they switch with the rest of the app.
26. Add the "Past Pods" history feature, per Section 3's `pod_history` schema/RLS/trigger and Section 5's Screen 4: add `pod_history` plus the `snapshot_pod_history` SECURITY DEFINER trigger (`supabase/sql/pod_history.sql`) that snapshots a pod and its accepted-member roster into a durable row on the `ACTIVE -> MATCHED` transition, before the Matched/Expired Pod Cleanup sweep can hard-delete the source rows. Add the `PodHistoryEntry`/`PodHistoryMember` types (`src/types/database.ts`), a fourth `TabBar` tab (`History` icon, ordered Pods/LFG/History/Profile) and a `/history` route (`src/app/(app)/history/page.tsx`) listing every `MATCHED` pod the viewer hosted or played in, with no realtime and no pagination control.
27. Add a per-viewer delete to the Past Pods list, per Section 5's Screen 4: `hidden_by uuid[]` on `pod_history` plus the `hide_pod_history_entry` SECURITY DEFINER RPC (`supabase/sql/pod_history.sql`) let a viewer soft-delete an entry from their own list without erasing it for the host/other members it's shared with. Split the previously server-only history page into a server fetch (`page.tsx`) plus a client `HistoryList` component (`src/components/HistoryList.tsx`) that optimistically removes a card and fires `deletePodHistoryEntry` (`src/app/actions/history.ts`), mirroring `NotificationBell`'s delete pattern.
28. Add a first light-gamification stat, per Section 3 and Section 5's Screen 4: `get_games_played_count()` SECURITY DEFINER RPC (`supabase/sql/pod_history.sql`) counting every `pod_history` row the caller appears in as host or member, ignoring `hidden_by` so the count doesn't shrink when an entry is deleted from the viewer's own Past Pods list. Render it as a "Games played: N" line on `/history/page.tsx`, above the Past Pods list.
29. Add the `POD_UPDATED_PENDING` notification type per Section 3/Section 5's Join Request Flow step 7: extend `notification_type` and add `notify_pending_joiners_on_pod_update`, a SECURITY DEFINER trigger on `pods` (`supabase/sql/notify_pending_joiners_on_pod_update.sql`) that fires alongside the existing (untracked) `notify_on_pod_update` on the same `ACTIVE -> ACTIVE` detail-edit condition, but fans out to every `PENDING` `pod_joins` row instead of `ACCEPTED` ones. Add the type to `src/types/database.ts`'s `NotificationType` and wire its icon/copy into `NotificationBell`'s `TYPE_ICON`/`describeNotification` plus both locale dictionaries (`notification.podUpdatedPending`), phrased around "requested to join" rather than "joined" since the recipient isn't a member yet.
30. Add draft Terms of Service / Privacy Policy pages, per Section 2's Legal subsection: `src/lib/legal/content.ts` (EN/FR section arrays, deliberately outside the flat i18n dictionary convention), the shared `src/components/LegalPage.tsx` renderer, and the `/terms`/`/privacy` routes (added to `PUBLIC_PATHS` in `src/proxy.ts`). Link both from `SettingsDialog` and from `LoginView`'s footer.
31. Add DB-level abuse/spam guardrails, per Section 3's new callout: `profiles.last_pod_created_at`/`last_join_request_at` plus `enforce_pod_creation_cooldown`/`enforce_join_request_cooldown` (`BEFORE INSERT` triggers on `pods`/`pod_joins`, `supabase/sql/rate_limits.sql`) enforcing a 15s/10s per-user cooldown. Catch the raised `RATE_LIMITED_POD_CREATE`/`RATE_LIMITED_JOIN_REQUEST` errors in `createPod`/`requestJoin` and surface translated messages instead.
32. Add account deletion, per Section 3's new callout and Section 5's Screen 1: the `delete_own_account()` SECURITY DEFINER RPC (`supabase/sql/account_deletion.sql`) anonymizes the caller's entries in other users' `pod_history.members` snapshots, then deletes their `auth.users` row (cascading through the existing FK chain). Add the `deleteAccount()` server action (`src/app/actions/profile.ts`), `DeleteAccountDialog` (mirroring `ConfirmMarkMatchedDialog`'s shape with a destructive confirm button), and wire a "Delete Account" button into `ProfileForm` below Sign Out.
```

If you have questions at any point, ask me directly.

ALWAYS keep these SPECS.md up to date with new features and changes.
