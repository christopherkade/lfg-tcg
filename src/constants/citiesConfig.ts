export interface CitySetting {
  key: string;
  label: string;
}

/**
 * Core extensibility list for IRL city scoping — mirrors `GAMES_CONFIG`
 * (see SPECS.md Section 4): supporting a new city only requires appending
 * an entry here, no schema or component changes needed. `key` is a
 * stable, filter-safe slug persisted on `profiles.city` / `beacons.city`
 * (never rendered directly); `label` is the display name shown in the UI.
 */
export const CITIES_CONFIG: CitySetting[] = [
  { key: "paris", label: "Paris" },
  { key: "marseille", label: "Marseille" },
  { key: "lyon", label: "Lyon" },
  { key: "toulouse", label: "Toulouse" },
  { key: "nice", label: "Nice" },
  { key: "nantes", label: "Nantes" },
  { key: "strasbourg", label: "Strasbourg" },
  { key: "montpellier", label: "Montpellier" },
  { key: "bordeaux", label: "Bordeaux" },
  { key: "lille", label: "Lille" },
  { key: "rennes", label: "Rennes" },
];

export const CITY_MAP: Record<string, CitySetting> = Object.fromEntries(
  CITIES_CONFIG.map((city) => [city.key, city]),
);
