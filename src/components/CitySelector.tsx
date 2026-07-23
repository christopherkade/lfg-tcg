"use client";

import { Autocomplete, TextField } from "@mui/material";
import { CITIES_CONFIG, CITY_MAP } from "@/constants/citiesConfig";

interface CitySelectorProps {
  value: string | null;
  onChange: (cityKey: string | null) => void;
}

/**
 * Config-driven city autocomplete (mirrors GameSelector/GAMES_CONFIG's
 * extensibility pattern — see SPECS.md Section 4). Persists the stable
 * `key` slug, not the free-text `label`, so IRL Match Feed filtering
 * (Section 6) can rely on exact equality instead of fuzzy text matching.
 */
export function CitySelector({ value, onChange }: CitySelectorProps) {
  return (
    <Autocomplete
      options={CITIES_CONFIG}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.key === selected.key}
      value={value ? (CITY_MAP[value] ?? null) : null}
      onChange={(_event, next) => onChange(next?.key ?? null)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="City"
          size="small"
          helperText="Used to only show you in-person beacons near you. Online beacons always show regardless of city."
        />
      )}
    />
  );
}
