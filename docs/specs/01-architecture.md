# 1. System Architecture & Tech Stack

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
- **Dates:** `formatPodWhen` (`src/lib/date.ts`) takes `(pod, locale, t)` and passes a `date-fns/locale` (`fr` or `undefined`) into every `format`/`formatDistanceToNowStrict` call, plus routes its wrapper phrases ("Starts in…", "Posted…", "Today, …") through `t()`. `NotificationBell`'s own relative-timestamp line does the same. `formatPodEndTime(pod, locale)`, alongside it, formats `pod.expires_at` the same way (`format(date, "p", { locale })`) — used only for organiser (recurring-table) pods, see Section 5's Match Feed/Pod Detail bullets.
- **Not translated:** game names (`GAMES_CONFIG[key].name`, e.g. "Magic: The Gathering") and city labels (`CITIES_CONFIG`) are treated as proper nouns and stay as authored. Formats, power-bracket label, and playstyle options are translated via key-based lookups (`format.${key}`, `tier.powerBracket`, `playstyle.${key}`) resolved at render time, so `GAMES_CONFIG`'s shape didn't need to change. The `<title>`/`<meta description>` in the root layout's static `metadata` export remain English-only (SEO/crawler-facing, out of scope for this pass).

### Theming (Light / Dark)

- **Approach:** A single MUI theme factory, `createAppTheme(mode)` (`src/lib/mui/theme.ts`), builds a full palette (background, text, divider, the fixed emerald `primary` brand accent, error) plus component style overrides (`MuiButton`, `MuiToggleButtonGroup`/`MuiToggleButton`, `MuiOutlinedInput`, `MuiInputLabel`) from a single `PaletteMode`. Every override reads `theme.palette.*` tokens rather than hardcoding hex, so both modes share one definition and stay in sync automatically.
- **Mode storage:** A `pm_theme` cookie (`light` | `dark`, default **`light`**) — mirrors the locale cookie's device/browser-level storage approach rather than a `profiles` column.
- **Client wiring:** `ThemeModeProvider`/`useThemeMode()` (`src/lib/theme/ThemeModeContext.tsx`) expose `{ mode, setMode }` via React Context, mounted in the root layout inside `LocaleProvider` and around `ThemeRegistry`. `setMode` updates both React state and the `pm_theme` cookie directly (`document.cookie`), the same pattern as `setLocale`. `ThemeRegistry` (`src/components/ThemeRegistry.tsx`) consumes `useThemeMode()` and builds `createAppTheme(mode)` via `useMemo`, feeding it into MUI's `ThemeProvider`; `CssBaseline` (mounted alongside it) applies the resulting `background.default`/text colors to `<body>`, so the root layout no longer hardcodes a background class.
- **Server wiring:** `getServerThemeMode()` (`src/lib/theme/server.ts`) reads the cookie via `await cookies()` for the root layout's initial `ThemeModeProvider` value, so the first server-rendered paint already matches the stored preference (no flash-of-wrong-theme).
- **`ThemeToggle`** (`src/components/ThemeToggle.tsx`): a two-button pill `ToggleButtonGroup` (sun icon = light, moon icon = dark), rendered inside the `SettingsDialog` modal alongside `LocaleSwitcher`. Selecting a mode calls `setMode` directly — no confirmation step.
- **Scope:** The toggle is genuinely app-wide — the navbar/tab bar (`TabBar`), the LFG Search dialog (`LfgDialog`, which previously always forced a light appearance regardless of the rest of the app), and `PowerBracketPicker` all resolve their colors from the ambient theme rather than hardcoded values, so they switch together with the rest of the UI.
