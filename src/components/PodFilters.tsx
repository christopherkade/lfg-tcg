"use client";

import { useState } from "react";
import { Box, Popover, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format as formatDate } from "date-fns";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { GameSelector } from "@/components/GameSelector";
import { PowerBracketPicker } from "@/components/PowerBracketPicker";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { GameKey, MatchType } from "@/types/database";

export interface PodFiltersValue {
  gameKey: GameKey | "ALL";
  matchType: MatchType | "ALL";
  formatKey: string | "ALL";
  date: Date | null;
  powerBrackets: number[];
}

// A fully neutral filter set — used by the "Clear all" action. The Match
// Feed's own *initial* state is computed separately (from the viewer's
// profile) so first load still browses meaningfully instead of showing
// every game/format at once; this constant only represents "no filters
// applied" from the user's point of view.
export const NEUTRAL_POD_FILTERS: PodFiltersValue = {
  gameKey: "ALL",
  matchType: "ALL",
  formatKey: "ALL",
  date: null,
  powerBrackets: [],
};

interface PodFiltersProps {
  value: PodFiltersValue;
  onChange: (value: PodFiltersValue) => void;
}

const MATCH_TYPE_OPTIONS: { key: MatchType | "ALL"; labelKey: TranslationKey }[] = [
  { key: "ALL", labelKey: "podFilters.matchTypeAll" },
  { key: "IRL", labelKey: "podFilters.matchTypeIrl" },
  { key: "ONLINE", labelKey: "podFilters.matchTypeOnline" },
];

type FilterKey = "game" | "matchType" | "format" | "date" | "powerBracket";

/**
 * Single source of truth for which filters actually render. Flip an entry
 * to `false` to remove that filter's chip (and popover) from the bar
 * entirely, or add a new `FilterKey` here plus a matching chip/popover pair
 * below to introduce one — no other wiring (state, query logic in
 * MatchFeed, etc.) needs to change just to toggle a filter's visibility.
 * Format and Power Bracket are still additionally gated by
 * `showFormatFilter`/`showPowerBracketFilter` below, since those two are
 * only ever meaningful for certain games regardless of this constant.
 */
const ENABLED_FILTERS: Record<FilterKey, boolean> = {
  game: true,
  matchType: true,
  format: false,
  date: true,
  powerBracket: false,
};

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 shrink-0 opacity-70"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? "border-ember/30 bg-ember/10 text-ember"
          : "border-zinc-800 bg-zinc-900 text-white hover:border-zinc-700 hover:text-white"
      }`}
    >
      {label}
      <ChevronIcon />
    </button>
  );
}

export function PodFilters({ value, onChange }: PodFiltersProps) {
  const { t } = useTranslation();
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  function openFilterAt(
    filter: FilterKey,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    setAnchorEl(event.currentTarget);
    setOpenFilter(filter);
  }

  function closeFilter() {
    setOpenFilter(null);
    setAnchorEl(null);
  }

  const selectedGame =
    value.gameKey !== "ALL" ? GAMES_CONFIG[value.gameKey] : null;
  const showFormatFilter =
    ENABLED_FILTERS.format &&
    selectedGame != null &&
    selectedGame.formats.length > 1;
  const showPowerBracketFilter =
    ENABLED_FILTERS.powerBracket && (selectedGame?.hasPowerTiers ?? false);

  const hasActiveFilters =
    value.gameKey !== "ALL" ||
    value.matchType !== "ALL" ||
    value.formatKey !== "ALL" ||
    value.date !== null ||
    value.powerBrackets.length > 0;

  function handleGameChange(next: string | null) {
    if (next === null) {
      return;
    }
    const nextGameKey = next as GameKey | "ALL";
    const nextGame = nextGameKey !== "ALL" ? GAMES_CONFIG[nextGameKey] : null;
    onChange({
      ...value,
      gameKey: nextGameKey,
      // Format/bracket options are game-specific, so reset both whenever
      // the selected game changes (mirrors LfgDialog's handleGameChange).
      formatKey: "ALL",
      powerBrackets: nextGame?.hasPowerTiers ? value.powerBrackets : [],
    });
    closeFilter();
  }

  const gameLabel = selectedGame ? selectedGame.name : t("podFilters.allGames");
  const matchTypeLabel =
    value.matchType === "ALL"
      ? t("podFilters.matchTypeLabel")
      : t(
          (MATCH_TYPE_OPTIONS.find((option) => option.key === value.matchType)
            ?.labelKey ?? "podFilters.matchTypeLabel"),
        );
  const formatLabel =
    value.formatKey === "ALL"
      ? t("podFilters.formatLabel")
      : t(`format.${value.formatKey}` as TranslationKey);
  const dateLabel = value.date ? formatDate(value.date, "MMM d") : t("podFilters.dateLabel");
  const powerBracketLabel = value.powerBrackets.length
    ? `${selectedGame?.tierLabel ? t("tier.powerBracket") : t("podFilters.bracketShort")} ${value.powerBrackets.join(", ")}`
    : (selectedGame?.tierLabel ? t("tier.powerBracket") : t("podFilters.powerBracketLabel"));

  const popoverSlotProps = {
    paper: {
      className: "border border-zinc-800",
      sx: { mt: 1, borderRadius: "16px" },
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-wrap items-center gap-2 sm:flex-nowrap">
      {ENABLED_FILTERS.game && (
        <FilterChip
          label={gameLabel}
          active={value.gameKey !== "ALL"}
          onClick={(event) => openFilterAt("game", event)}
        />
      )}
      {ENABLED_FILTERS.matchType && (
        <FilterChip
          label={matchTypeLabel}
          active={value.matchType !== "ALL"}
          onClick={(event) => openFilterAt("matchType", event)}
        />
      )}
      {showFormatFilter && (
        <FilterChip
          label={formatLabel}
          active={value.formatKey !== "ALL"}
          onClick={(event) => openFilterAt("format", event)}
        />
      )}
      {ENABLED_FILTERS.date && (
        <FilterChip
          label={dateLabel}
          active={value.date !== null}
          onClick={(event) => openFilterAt("date", event)}
        />
      )}
      {showPowerBracketFilter && (
        <FilterChip
          label={powerBracketLabel}
          active={value.powerBrackets.length > 0}
          onClick={(event) => openFilterAt("powerBracket", event)}
        />
      )}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => onChange(NEUTRAL_POD_FILTERS)}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-white transition-colors hover:text-white"
        >
          {t("podFilters.clearAll")}
        </button>
      )}

      {ENABLED_FILTERS.game && (
        <Popover
          open={openFilter === "game"}
          anchorEl={anchorEl}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={popoverSlotProps}
        >
          <Box
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              width: 260,
            }}
          >
            <span className="text-xs font-medium text-white">{t("podFilters.gameSectionLabel")}</span>
            <GameSelector
              value={value.gameKey}
              onChange={handleGameChange}
              includeAllOption
              columns={{ xs: 2, sm: 2 }}
            />
          </Box>
        </Popover>
      )}

      {ENABLED_FILTERS.matchType && (
        <Popover
          open={openFilter === "matchType"}
          anchorEl={anchorEl}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={popoverSlotProps}
        >
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="text-xs font-medium text-white">
              {t("podFilters.matchTypeLabel")}
            </span>
            <ToggleButtonGroup
              value={value.matchType}
              exclusive
              onChange={(_event, next: MatchType | "ALL" | null) => {
                if (next !== null) {
                  onChange({ ...value, matchType: next });
                  closeFilter();
                }
              }}
            >
              {MATCH_TYPE_OPTIONS.map((option) => (
                <ToggleButton key={option.key} value={option.key}>
                  {t(option.labelKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Popover>
      )}

      {showFormatFilter && selectedGame && (
        <Popover
          open={openFilter === "format"}
          anchorEl={anchorEl}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={popoverSlotProps}
        >
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="text-xs font-medium text-white">{t("podFilters.formatLabel")}</span>
            <ToggleButtonGroup
              value={value.formatKey}
              exclusive
              onChange={(_event, next: string | null) => {
                if (next !== null) {
                  onChange({ ...value, formatKey: next });
                  closeFilter();
                }
              }}
              sx={{
                flexWrap: "wrap",
                bgcolor: "transparent",
                border: 0,
                p: 0,
                gap: 1,
                maxWidth: 260,
              }}
            >
              <ToggleButton value="ALL">{t("podFilters.allFormats")}</ToggleButton>
              {selectedGame.formats.map((formatOption) => (
                <ToggleButton key={formatOption.key} value={formatOption.key}>
                  {t(`format.${formatOption.key}` as TranslationKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Popover>
      )}

      {ENABLED_FILTERS.date && (
        <Popover
          open={openFilter === "date"}
          anchorEl={anchorEl}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={popoverSlotProps}
        >
          <Box sx={{ p: 2 }}>
            <DatePicker
              value={value.date}
              onChange={(next) => {
                onChange({ ...value, date: next });
                closeFilter();
              }}
              slotProps={{
                textField: { fullWidth: true, size: "small" },
                field: {
                  clearable: true,
                  onClear: () => {
                    onChange({ ...value, date: null });
                    closeFilter();
                  },
                },
              }}
            />
          </Box>
        </Popover>
      )}

      {showPowerBracketFilter && selectedGame && (
        <Popover
          open={openFilter === "powerBracket"}
          anchorEl={anchorEl}
          onClose={closeFilter}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={popoverSlotProps}
        >
          {/* Power Bracket is multi-select (any combination of tiers), so
              its popover deliberately stays open after each toggle — unlike
              the single-value filters above, closing here would force a
              reopen for every additional bracket the viewer wants to add. */}
          <Box sx={{ p: 2, pt: 0 }}>
            <PowerBracketPicker
              visible
              value={value.powerBrackets}
              onChange={(brackets) =>
                onChange({ ...value, powerBrackets: brackets })
              }
              maxTier={selectedGame.maxTier}
              label={selectedGame.tierLabel ? t("tier.powerBracket") : undefined}
            />
          </Box>
        </Popover>
      )}
    </div>
  );
}
