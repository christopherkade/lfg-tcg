# Product Requirement Document (PRD) & Technical Specification

**Project:** Cross-TCG LFG Matchmaker (ManaMatch PWA)
**Stack:** Next.js (App Router), Supabase (Auth, Database, Realtime), Tailwind CSS, Framer Motion.
**Approach:** Mobile-first Progressive Web App (PWA) focusing on real-time LFG matchmaking for IRL and Online play, initializing from a robust user profile preference system.

---

## 1. System Architecture & Tech Stack

### Frontend

- **Framework:** Next.js (App Router, leveraging Client Components for reactive settings forms and real-time beacon feed updates).
- **Navigation:** A three-tab information architecture — **Active Beacons**, **LFG**, **Profile** — rendered as a fixed bottom tab bar with icons on mobile, and a top navbar with icon + label on desktop (`sm:` breakpoint and up). See Section 5 for the full screen breakdown.
- **Styling:** Tailwind CSS, designed mobile-first.
- **Animations:** **Framer Motion** for conditional layout morphing (the Profile screen's power bracket picker) and the active beacon pulse.

### Backend & Realtime

- **Database & Auth:** Supabase (PostgreSQL with Row Level Security). Authentication via Discord OAuth only (see Section 2).
- **Realtime Subscriptions:** Enabled on the `beacons`, `beacon_joins`, and `notifications` tables to push instant matching feeds and notification-center updates.
- **Notification center:** A persisted `notifications` table (populated exclusively by SECURITY DEFINER database triggers, not application code) backs a header bell with an unread-count badge — see Section 3's Notifications subsection and Section 7.

---

## 2. Authentication

- **Provider:** Discord OAuth via Supabase Auth (`supabase.auth.signInWithOAuth({ provider: 'discord' })`). No email/password or magic-link flow is supported.
- **Prerequisite (external, not code):** A Discord Developer Portal application (Client ID/Secret) registered as an OAuth provider in the Supabase project's Auth settings, with the Supabase-provided callback URL (`https://<project>.supabase.co/auth/v1/callback`) set as the Discord app's redirect URI.
- **Callback route:** `/auth/callback/route.ts` exchanges the OAuth `code` for a session (`exchangeCodeForSession`), then redirects to `/`.
- **Discord handle prefill:** On first login, the user's Discord identity metadata (`user.user_metadata`) is used to prefill the `discord_handle` field on the Profile screen (identity fields only, see Section 5); the user can edit it before submitting.
- **Route gating:**
  - `proxy.ts` (this Next.js version's renamed `middleware.ts`) performs an _optimistic_ check for the Supabase auth cookie and redirects unauthenticated requests to `/login` (except `/login` and `/auth/callback` themselves). Proxy is not a substitute for real session validation.
  - The real gate is server-side: each protected Server Component queries `profiles` by `auth.uid()`. If no session exists, redirect to `/login`. If a session exists but no `profiles` row exists yet, redirect to `/profile` to force onboarding before the LFG or Active Beacons tabs can be reached.

---

## 3. Polymorphic Database Schema (PostgreSQL / Supabase)

Execute this SQL snippet in your Supabase SQL Editor. The canonical, up-to-date copy of this script lives at `supabase/schema.sql` (it also includes `DROP ... IF EXISTS` statements at the top so it can be re-run cleanly during development — remove that block before running against a project with real user data).

> **Important:** Every `preferred_*` column on `profiles` has a sensible default (see DDL below), so a brand-new profile row — created with only `id`/`username`/`discord_handle` from the Profile screen's identity form — is valid immediately without the constraints failing. This is what allows onboarding to stay a simple two-field form while the LFG search dialog (Section 5) still has real values to pre-fill with on first use.
>
> **Profile stores the _last-used_ search settings, not a fixed preference.** Game, format, playstyle, acceptable power brackets, match type, location, and desired group size are edited exclusively via the "Search" dialog on the LFG tab (not the Profile screen). Every time `createBeacon` runs, it both (a) updates these `preferred_*` columns to match what was just searched for, and (b) snapshots them into the new `beacons` row. This keeps the dialog's next pre-fill, and the Match Feed's filtering, in sync with the user's most recent search.
>
> **`beacons` SELECT RLS must include accepted members, not just `status = 'ACTIVE'` or the owner.** Supabase Realtime's `postgres_changes` re-checks a table's SELECT policy against the row being changed for every single subscriber, on every event — if that check fails for a given subscriber, they simply never receive the event (no error, it's silent). If the policy were only `status = 'ACTIVE' OR user_id = auth.uid()`, then the instant a host marks their beacon `MATCHED`, every accepted member's subscription would start failing that check (they're neither `ACTIVE` nor the owner), so they'd never find out: `MatchedBeaconWatcher`'s `MatchedDialog` wouldn't fire for them, and their own `MatchFeed` would keep showing the now-stale card forever (no event ever tells their client to refetch and drop it). The fix is allowing accepted members through the policy regardless of the beacon's current `status`.
>
> **That accepted-member check must go through the `public.is_accepted_beacon_member(uuid)` SECURITY DEFINER function, not an inline `exists (select 1 from beacon_joins ...)`.** `beacon_joins`'s own SELECT policy queries `beacons` back (to check host ownership), so an inline subquery on `beacons` creates a policy cycle — beacons policy → beacon_joins policy → beacons policy → ... — which Postgres rejects with `infinite recursion detected in policy for relation "beacons"`. The SECURITY DEFINER function runs as its (RLS-bypassing) owner, so its internal query against `beacon_joins` doesn't re-trigger `beacon_joins`'s RLS policy, breaking the cycle.

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

-- 2. Beacons Table (active LFG requests, snapshotting the host's profile settings)
CREATE TABLE beacons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    game_key TEXT NOT NULL,
    format_key TEXT NOT NULL,        -- e.g., 'COMMANDER', 'STANDARD'
    playstyle_key TEXT NOT NULL,     -- 'casual' or 'competitive'
    power_tiers INT[] CHECK (power_tiers IS NULL OR power_tiers <@ ARRAY[1,2,3,4,5]), -- snapshot of profiles.preferred_brackets if MTG, NULL otherwise
    type match_type NOT NULL,        -- 'IRL' or 'ONLINE'
    location_name TEXT,              -- E.g., 'Local Game Store Name' (Null if ONLINE)
    max_players INT NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 6), -- Total group size including the host; snapshot of preferred_max_players
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 300), -- Optional free-text note set in the Search dialog, one-off (not persisted onto profiles)
    status TEXT DEFAULT 'ACTIVE',    -- 'ACTIVE', 'MATCHED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '4 hours')
);

-- Enforce a single ACTIVE beacon per user
CREATE UNIQUE INDEX beacons_one_active_per_user ON beacons(user_id) WHERE status = 'ACTIVE';

-- 3. Beacon Joins (Join requests, subject to host approval)
CREATE TABLE beacon_joins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    beacon_id UUID REFERENCES beacons(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status join_status NOT NULL DEFAULT 'PENDING',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_beacon UNIQUE (beacon_id, user_id)
);

-- 4. Notifications (persisted notification center backing the header bell)
CREATE TYPE notification_type AS ENUM (
    'JOIN_REQUEST', 'JOIN_ACCEPTED', 'JOIN_REJECTED', 'MEMBER_LEFT', 'BEACON_UPDATED'
);
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    beacon_id UUID REFERENCES beacons(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

> **Notifications have no `message` column.** Display copy is composed client-side (`NotificationBell`'s `describeNotification()`) from `type` plus the embedded `actor`/`beacon` rows — this keeps copy easy to change/localize later without needing to backfill historical rows.
>
> **Rows are inserted exclusively by SECURITY DEFINER database triggers, never by application code.** `notify_on_beacon_join_insert/update/delete` (on `beacon_joins`) and `notify_on_beacon_update` (on `beacons`) — all defined alongside the RLS policies in `supabase/schema.sql` — cover, respectively: a new join request (host notified), a request accepted/rejected (joiner notified), an accepted member leaving (host notified), and the host editing an already-live beacon's details (every accepted member notified). Driving this from triggers rather than the server actions in `src/app/actions/` means every current and future mutation path gets consistent notification coverage automatically, and lets `notifications` ship with **no client-facing INSERT policy at all** — a user can never fabricate a notification for someone else. A `MATCHED` status transition is deliberately **not** one of these five types; it already has its own dedicated blocking `MatchedDialog` UX (via `MatchedBeaconWatcher`, see Section 5's Join Request Flow step 5), not a notification-center entry.

### Row Level Security

RLS must be enabled on all three tables with the following policies:

| Table           | Operation       | Rule                                                                                                                                                                                                                                                                                         |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`      | SELECT          | Any authenticated user (needed to display host/joiner info in the feed and join requests)                                                                                                                                                                                                    |
| `profiles`      | INSERT / UPDATE | Only where `auth.uid() = id`                                                                                                                                                                                                                                                                 |
| `beacons`       | SELECT          | Where `status = 'ACTIVE'` OR `user_id = auth.uid()` (owners can always see their own beacon) OR `public.is_accepted_beacon_member(beacons.id)` is true (accepted members keep visibility after it leaves `ACTIVE`, e.g. `MATCHED` — see the Realtime + RLS-recursion notes below the schema) |
| `beacons`       | INSERT          | Only where `user_id = auth.uid()`                                                                                                                                                                                                                                                            |
| `beacons`       | UPDATE          | Only where `user_id = auth.uid()` (status / `max_players` changes)                                                                                                                                                                                                                           |
| `beacon_joins`  | SELECT          | Where `status = 'ACCEPTED'` (accepted members are public on active beacons) OR `user_id = auth.uid()` (own requests) OR the beacon is owned by `auth.uid()` (host reviewing requests)                                                                                                        |
| `beacon_joins`  | INSERT          | Only where `user_id = auth.uid()` AND the target beacon is not owned by `auth.uid()` (cannot join your own beacon)                                                                                                                                                                           |
| `beacon_joins`  | UPDATE          | Only where the target beacon is owned by `auth.uid()` (only the host can Accept/Reject)                                                                                                                                                                                                      |
| `beacon_joins`  | DELETE          | Only where `user_id = auth.uid()` (a joiner can cancel a PENDING request or leave after being ACCEPTED)                                                                                                                                                                                      |
| `notifications` | SELECT          | Only where `recipient_id = auth.uid()`                                                                                                                                                                                                                                                       |
| `notifications` | UPDATE          | Only where `recipient_id = auth.uid()` (marking read/all-read)                                                                                                                                                                                                                               |
| `notifications` | INSERT/DELETE   | No policy for `authenticated` at all — every row is created by the SECURITY DEFINER trigger functions described above, which bypass RLS                                                                                                                                                      |

### Realtime

Enable Supabase Realtime replication on the `beacons`, `beacon_joins`, and `notifications` tables to push instant matching feed, join-request, and notification-center updates.

---

## 4. Core Extensibility Architecture (`/constants/gamesConfig.ts`)

This configuration matrix drives both the Profile screen's settings form and the Active Beacons match feed filtering.

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

---

## 5. UI/UX Interface Layout & Screen Flows

### Navigation Shell

Three tabs, in this left-to-right order: **Active Beacons**, **LFG**, **Profile**. `LFG` (`/`) is the middle tab and the default route. `Active Beacons` (`/beacons`) is on the left. `Profile` (`/profile`) is on the right.

- **Mobile:** a fixed bottom tab bar, one icon + label per tab.
- **Desktop (`sm:` and up):** a top navbar with the app name on the left and the three tabs (icon + label) on the right, replacing the bottom bar.

### Screen 1: Profile (`/profile/page.tsx`) — identity only

- **Standard Fields:** Text inputs for `username` and `discord_handle` (the latter prefilled from Discord OAuth identity metadata, see Section 2, and editable).
- Saving submits `username`/`discord_handle` in one upsert to `profiles` (see Section 3); the `preferred_*` search-setting columns are left untouched by this form (they're edited via the LFG Search dialog instead, see Screen 2).
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
   - **Playstyle Toggle:** Segmented toggle between **Casual** and **Competitive**.
   - **Conditional Power Bracket Interface (Framer Motion Enhanced, multi-select):** Shown only when `selectedGame === 'MTG'`. Each of the 5 nodes toggles independently — any combination can be selected. Submission is blocked until at least one bracket is selected while the game is MTG; switching away from MTG clears the selection.
   - **Players Needed Stepper:** Numeric stepper (2–6, default 2) — total group size including the host.
   - **Notes Field (optional):** A free-text textarea (300 char max, with a live character counter) for anything else players should know (deck theme, house rules, etc.). Reset to empty each time the dialog opens — unlike the other fields, it is a one-off message for this search, not a persisted preference.
   - A **Search** button at the bottom of the dialog submits these fields (see `createBeacon` below); a **Cancel** button (or clicking the backdrop) closes the dialog without starting a search.
2. **Search Initialization:** Clicking **Search** calls `createBeacon` with the dialog's field values. This both (a) updates the user's `profiles.preferred_*` columns to match (so the dialog pre-fills with this search next time, and the Match Feed keeps filtering off it), and (b) snapshots those same values into a new `beacons` row (game, format, playstyle, brackets → `power_tiers`, match type, location, `max_players`, notes). The `notes` value is stored only on the `beacons` row, not persisted onto `profiles`. Blocked if the user already has an ACTIVE beacon (enforced by the `beacons_one_active_per_user` index). On success the dialog closes and the button starts its infinite pulsing glow animation, mapped to the current game's `glowColor`.
3. **Search Resignation:** While searching, clicking the button (now showing **CANCEL**) directly flips the beacon's `status` to `EXPIRED` — no dialog involved.

### Screen 3: Active Beacons (`/beacons/page.tsx`) — browse + host management

The left tab. Combines the Match Feed (browsing others' beacons) with the host's own Beacon Panel (if they have an ACTIVE beacon), so all beacon-related activity lives in one place separate from the LFG action button. When the Match Feed has no results, its "No active beacons match your filters yet." message is centered in the remaining screen space (not top-aligned).

**My Beacon Panel** (shown at the top of this screen only when the user has an ACTIVE beacon):

- Lists pending join requests (`beacon_joins.status = 'PENDING'`) as requester profile cards (avatar, username, discord_handle) with **Accept** / **Reject** actions.
- Lists already-accepted members (`status = 'ACCEPTED'`) so the host can track pod fill progress against `max_players`. Discord's public API does not allow third-party apps to auto-create a group DM for arbitrary users (the `gdm.join` OAuth scope needed is restricted/deprecated for new apps), and a profile-by-ID deep link (`discord.com/users/<id>`) isn't a viable substitute either — Discord only resolves that for users you already share a server with or are friends with, so for two strangers matched by this app it just bounces to `/channels/@me` regardless of how correct the id is. The only mechanism that reliably works for strangers is Discord's own "Add Friend" search-by-username flow, so each Group Member row has its own **Copy Handle** button, plus a **Copy All Handles** button below the list, so the host can paste handles straight into that search.
- Accept/Reject actions are disabled once accepted joiners plus the host reach `max_players`.
- **Mark as Matched button:** host-only. Rather than immediately flipping the beacon's `status`, it first opens a lightweight **warning dialog** (`ConfirmMarkMatchedDialog`) reminding the host to add everyone on Discord (via the Copy Handle buttons above) before continuing, since marking as matched removes the beacon from the match feed for good. Only once the host clicks **Mark as Matched** inside that dialog does the beacon's `status` actually become `MATCHED` (manual action — no automatic transition based on fill count).

**Match Feed** (below My Beacon Panel, always shown): browsing UI for other users' active beacons, filtered automatically using the viewer's own `profiles` settings (game, playstyle, and — for MTG — an overlap check against `preferred_brackets`). See Section 6. Each card is a summary only (host, format/type/location/brackets, accepted members, and the viewer's own join status badge if they've already requested) — it has no action button. Clicking anywhere on the card opens a **Beacon Detail dialog** (`BeaconDetailDialog`) showing the full beacon information — host identity, game/format/playstyle/match type/location, power brackets, `notes`, and the accepted-members list — plus the **Request to Join** action/status, which only ever appears in this dialog.

### Join Request Flow (Match Feed → Host Approval → Mutual Reveal)

1. A searcher browsing the Match Feed (Active Beacons tab) sees an ACTIVE beacon card showing the host's public info and any already-**ACCEPTED** members of the group/pod. Clicking the card opens the Beacon Detail dialog described above.
2. Clicking **Request to Join** (from the detail dialog — the card itself has no join button) inserts a `beacon_joins` row with `status = 'PENDING'`. The dialog then shows a "Pending" state to the searcher, also reflected as a status badge back on the card.
3. The host sees the new pending request appear in real time on their own Beacon Panel (Active Beacons tab), including the requester's profile. A `notifications` row is also inserted for the host (`JOIN_REQUEST`, via a database trigger — see Section 3), which the header `NotificationBell` surfaces as an unread badge plus, if the site is currently open, a native OS notification (via the browser `Notification` API, if permission was granted) and an in-app toast. Clicking the notification, toast, or its entry in the bell dropdown navigates the host to `/beacons` — the Beacon Panel there is where they act.
4. The host clicks **Accept** or **Reject**. On accept, `status` becomes `'ACCEPTED'` and the requester is added to the visible members list on both the host's panel and the Match Feed card; the requester now also sees the full accepted-members list (including discord handles) for that beacon. On reject, `status` becomes `'REJECTED'` and the request is terminal (no re-request in this scope). Either way, a trigger inserts a `JOIN_ACCEPTED`/`JOIN_REJECTED` notification for the requester, surfaced the same way via `NotificationBell`.
5. When the host marks the beacon as matched (see My Beacon Panel above), every ACCEPTED member (not the host, who already knows) is shown a blocking **`MatchedDialog`** — telling them to head to Discord and warning that the beacon's card is about to disappear from the match feed (since `MATCHED` beacons no longer satisfy the `status = 'ACTIVE'` filter every match feed query uses). This is a dialog rather than a dismissable snackbar/notification specifically because it's the only cue those members get that the card will vanish, and deliberately isn't part of the `notifications` bell (see Section 3). Delivered via `MatchedBeaconWatcher`'s realtime subscription (a `beacons` UPDATE handler checking `status = 'MATCHED'` plus an own-`beacon_joins` lookup), subject to the same foreground-only caveat as the rest of that component (see Section 7).
6. Two further trigger-backed notification types round out the notification center (not tied to the join flow above): **`MEMBER_LEFT`** — the host is notified when an already-accepted member leaves their beacon (cancelling a still-PENDING request notifies no one); and **`BEACON_UPDATED`** — every accepted member is notified when the host edits their live beacon's details via `updateBeacon` (Section 5's My Beacon Panel "Edit Beacon" button).

---

## 6. Match Feed Query Layout (`/components/MatchFeed.tsx`)

A component updating dynamically via real-time channel infrastructure. It takes the viewer's `profile` (not a separate filter-override state) and their user id as props. The query excludes the viewer's own beacon and expired rows, joins each beacon's `beacon_joins` so accepted members can be rendered on the card, and for MTG uses an array **overlap** check (`&&`) between the beacon's `power_tiers` and the viewer's `preferred_brackets` — any shared bracket counts as a match:

```typescript
// Filters directly off the viewer's own profile settings — there is no
// separate dashboard override state to read from.
const fetchActiveBeacons = async (profile: Profile, currentUserId: string) => {
  let query = supabase
    .from("beacons")
    .select("*, profiles(*), beacon_joins(*, profiles(*))")
    .eq("game_key", profile.preferred_game)
    .eq("playstyle_key", profile.preferred_playstyle)
    .eq("status", "ACTIVE")
    .gt("expires_at", new Date().toISOString())
    .neq("user_id", currentUserId);

  // Overlap match: any shared bracket between the viewer's acceptable
  // brackets and the beacon's snapshotted power_tiers counts as a match.
  if (profile.preferred_game === "MTG" && profile.preferred_brackets?.length) {
    query = query.overlaps("power_tiers", profile.preferred_brackets);
  }

  const { data } = await query;
  setBeacons(data);
};
```

Only `beacon_joins` rows with `status = 'ACCEPTED'` should be rendered as visible group members on each card; `PENDING`/`REJECTED` rows belonging to other users are not shown to searchers (RLS also restricts this — a searcher can only ever see their own join rows).

---

## 7. Progressive Web App Scope

This implementation pass targets **installability**, plus foreground join-request alerts:

- `app/manifest.ts` (Next.js built-in manifest convention) with name, short_name, theme/background colors, and 192x192 / 512x512 icons in `public/`.
- No service worker, no offline caching in this scope.
- **Notification center (not push):** `NotificationBell` (rendered in `TabBar`'s desktop navbar and a dedicated mobile top bar, since the mobile layout previously had no top header) reads/subscribes to the persisted `notifications` table (Section 3) and shows an unread-count badge, a dropdown of recent notifications, plus a native OS `Notification` and in-app toast when a new one arrives while the tab is open. `MatchedBeaconWatcher` (mounted app-wide in the `(app)` layout, formerly `JoinRequestNotifier`) separately shows a blocking `MatchedDialog` to accepted members when their beacon is marked `MATCHED` (see Section 5's Join Request Flow, step 5). Both only fire while the PWA/tab process is actually running (foreground or backgrounded tab) — there is no service worker or server-triggered push involved, so nothing is delivered while the app is fully closed. The persisted `notifications` table means the bell's unread history survives reloads/relaunches even though live delivery is foreground-only.

---

## 8. Explicit Scope Exclusions

- No true push notifications (no service worker, no server-triggered delivery while the app is fully closed) and no offline/service-worker caching — see Section 7. The foreground `Notification`/snackbar join-request alert is not a substitute for push.
- No geolocation/proximity matching for IRL beacons — `location_name` remains a free-text field.
- No automated expiry sweep job (pg_cron / scheduled Edge Function); expiry is enforced only via query-time `expires_at` filtering. A follow-up scheduled job is recommended but out of scope for this pass.
- No pagination/infinite scroll on the Match Feed (MVP scale assumption).
- No re-request after a `REJECTED` join (terminal state for this pass).
- No per-search override screen separate from the dialog described in Section 5 — the LFG tab's Search dialog is the only place game settings are edited; the Profile tab holds identity fields (and sign-out) only.
- No automatic Discord group DM/channel creation — Discord's public API requires each participant to individually authorize the `gdm.join` OAuth scope (restricted/effectively deprecated for new apps), and a bot token cannot create or add arbitrary users to a group DM. There's also no reliable profile-by-ID deep link for two strangers (see Section 5's My Beacon Panel). The Copy Handle / Copy All Handles buttons on the Group Members list are a manual-assist alternative, not real automation.

---

## 9. AI Agent Implementation Steps

```markdown
1. Mount foundational project libraries: `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, `lucide-react`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, and create `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server, cookie-based) using `@supabase/ssr`.
3. Execute the schema + RLS + Realtime SQL from Section 3 (`supabase/schema.sql`) in the Supabase SQL Editor.
4. Scaffold core database types directly matching properties outlined in Section 3.
5. Add `proxy.ts` for optimistic auth redirects and `/auth/callback/route.ts` for the Discord OAuth code exchange, per Section 2.
6. Build the `(app)` route group with a shared layout rendering `TabBar` (mobile bottom nav / desktop top navbar) around three routes: `/` (LFG), `/beacons` (Active Beacons), `/profile` (Profile). `/login` and `/auth/callback` stay outside this group.
7. Code the Profile screen (`/profile/page.tsx`) as an identity-only form (username, discord handle) plus a destructive Sign Out button, per Section 5.
8. Code the LFG tab's Search dialog (`LfgDialog`), pre-filled from the profile's last-used settings (game, format, match type, location, playstyle, multi-select power brackets, players needed), wiring the conditional Framer Motion bracket picker to the MTG check.
9. Build dynamic UI components leveraging Tailwind values inherited dynamically from `GAMES_CONFIG[game].themeColor`.
10. Implement the beacon lifecycle as Server Actions: `createBeacon` takes the dialog's field values, persists them onto `profiles.preferred_*`, and snapshots them into a new `beacons` row; `cancelBeacon`/`markBeaconMatched` operate by id. Implement the join-request flow (request/accept/reject), per Sections 5 and 6.
11. Bind real-time reactive data hooks matching data parameter strings directly into the Postgres engine layers.
12. Add `app/manifest.ts` and icons per Section 7.
13. Add the optional `notes` field to the Search dialog and `beacons` table; add `BeaconDetailDialog` (opened by clicking a Match Feed card) per Section 5; add join-request alerting (native `Notification` + in-app snackbar on new join requests, mounted in the `(app)` layout) per Sections 5 and 7.
14. Add per-member **Copy Handle** / **Copy All Handles** buttons to the Group Members list, and a **Mark as Matched** button that opens `ConfirmMarkMatchedDialog` (a warning reminding the host to add everyone on Discord first) before `markBeaconMatched` actually runs, per Section 5 and Section 8's Discord API constraint.
15. Extend the join-request alerting with a `MatchedDialog`, shown to each accepted member (not the host) when their beacon transitions to `MATCHED`, per Section 5's Join Request Flow step 5.
16. Add the persisted `notifications` table + `notification_type` enum + SECURITY DEFINER triggers (`notify_on_beacon_join_insert/update/delete`, `notify_on_beacon_update`) per Section 3, covering join request / accepted / rejected / member-left / beacon-updated. Build `NotificationBell` (unread badge, dropdown, toast + native notification on new inserts, realtime-subscribed with no server-side `filter` — RLS's `recipient_id = auth.uid()` check alone scopes each subscriber to their own rows, matching every other realtime subscription in this codebase) and mount it in `TabBar`'s desktop navbar plus a new mobile top bar. Narrow the former `JoinRequestNotifier` down to just the `MatchedDialog` watcher and rename it `MatchedBeaconWatcher`, since `NotificationBell` now owns the join-request/accepted/rejected alerts via the persisted table instead of listening to `beacon_joins`/`beacons` directly.
```

If you have questions at any point, ask me directly.

ALWAYS keep these SPECS.md up to date with new features and changes.
