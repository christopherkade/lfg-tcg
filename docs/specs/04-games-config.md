# 4. Core Extensibility Architecture (`/constants/gamesConfig.ts`)

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
