"use client";

import { forwardRef } from "react";
import type { HTMLAttributes, ReactElement, Ref } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import { autocompleteClasses } from "@mui/material/Autocomplete";
import { List, type RowComponentProps } from "react-window";
import { CITIES_CONFIG, CITY_MAP } from "@/constants/citiesConfig";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface CitySelectorProps {
  value: string | null;
  onChange: (cityKey: string | null) => void;
}

// CITIES_CONFIG covers ~2,300 French communes (see SPECS.md Section 4), so
// the Autocomplete's option list is virtualized to avoid rendering every
// <li> up front. Swapping out the listbox slot loses MUI's own
// `.MuiAutocomplete-option` padding/hover/selected styling — that CSS is
// only injected when MUI's internal listbox component itself renders — so
// it's reproduced here on our replacement root.
const ROW_HEIGHT = 48;
const MAX_VISIBLE_ROWS = 6;

const ListboxRoot = styled("div")(({ theme }) => ({
  padding: "8px 0",
  maxHeight: "40vh",
  overflow: "hidden",
  [`& .${autocompleteClasses.option}`]: {
    display: "flex",
    overflow: "hidden",
    justifyContent: "flex-start",
    alignItems: "center",
    cursor: "pointer",
    boxSizing: "border-box",
    height: ROW_HEIGHT,
    paddingLeft: 16,
    paddingRight: 16,
    outline: "0",
    WebkitTapHighlightColor: "transparent",
    [`&.${autocompleteClasses.focused}`]: {
      backgroundColor: theme.palette.action.hover,
    },
    '&[aria-selected="true"]': {
      backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
    },
  },
}));

function VirtualizedRow({ index, style, items }: RowComponentProps<{ items: ReactElement[] }>) {
  return <div style={style}>{items[index]}</div>;
}

interface VirtualizedListboxProps extends HTMLAttributes<HTMLElement> {
  ownerState?: unknown;
}

const VirtualizedListbox = forwardRef(function VirtualizedListbox(
  { children, ownerState, ...rest }: VirtualizedListboxProps,
  ref: Ref<HTMLDivElement>,
) {
  void ownerState;
  const items = Array.isArray(children) ? (children as ReactElement[]) : [];
  const height = Math.min(items.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;

  return (
    <ListboxRoot ref={ref} {...rest}>
      <List
        rowComponent={VirtualizedRow}
        rowCount={items.length}
        rowHeight={ROW_HEIGHT}
        rowProps={{ items }}
        defaultHeight={height}
        style={{ height }}
      />
    </ListboxRoot>
  );
});

/**
 * Config-driven city autocomplete (mirrors GameSelector/GAMES_CONFIG's
 * extensibility pattern — see SPECS.md Section 4). Persists the stable
 * `key` slug, not the free-text `label`, so IRL Match Feed filtering
 * (Section 6) can rely on exact equality instead of fuzzy text matching.
 */
export function CitySelector({ value, onChange }: CitySelectorProps) {
  const { t } = useTranslation();
  return (
    <Autocomplete
      options={CITIES_CONFIG}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.key === selected.key}
      value={value ? (CITY_MAP[value] ?? null) : null}
      onChange={(_event, next) => onChange(next?.key ?? null)}
      slots={{ listbox: VirtualizedListbox }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("citySelector.label")}
          size="small"
          helperText={t("citySelector.helperText")}
        />
      )}
    />
  );
}
