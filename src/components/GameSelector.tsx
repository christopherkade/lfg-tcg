"use client";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface GameSelectorProps {
  value: string;
  onChange: (gameKey: string) => void;
  /** Renders an extra "All Games" pill (value `"ALL"`) ahead of the games. */
  includeAllOption?: boolean;
  /**
   * Grid column count per breakpoint. Defaults to the dialog's layout
   * (2 columns on narrow screens, 4 once there's room). The default's `sm`
   * step is a *viewport*-width breakpoint, so callers rendering this inside
   * a narrow, fixed-width container (e.g. a popover) on an otherwise wide
   * screen must override it — otherwise the grid still switches to 4
   * columns and the pills overflow their container.
   */
  columns?: { xs: number; sm: number };
}

// Mirrors each game's Tailwind theme color (see gamesConfig.ts) as hex
// values, since MUI's sx prop needs real colors rather than Tailwind
// utility classes to reliably win the specificity fight against the
// theme's default `.Mui-selected` styling.
const ACTIVE_COLORS: Record<string, string> = {
  MTG: "#f59e0b", // amber-500
  ONE_PIECE: "#3b82f6", // blue-500
  POKEMON: "#facc15", // yellow-400
  LORCANA: "#a855f7", // purple-500
};

function gamePillSx(activeColor: string) {
  return {
    borderRadius: "10px !important",
    border: "1px solid",
    borderColor: "#27272a",
    bgcolor: "#18181b",
    color: "#d4d4d8",
    minWidth: 0,
    px: 1,
    py: { xs: 0.75, sm: 1.25 },
    "&.Mui-selected": {
      borderColor: `${activeColor}4d`,
      bgcolor: `${activeColor}1a`,
      color: activeColor,
    },
    "&.Mui-selected:hover": {
      bgcolor: `${activeColor}26`,
    },
  };
}

export function GameSelector({
  value,
  onChange,
  includeAllOption,
  columns = { xs: 2, sm: 4 },
}: GameSelectorProps) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_event, next) => {
        if (next !== null) {
          onChange(next);
        }
      }}
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: `repeat(${columns.xs}, minmax(0, 1fr))`,
          sm: `repeat(${columns.sm}, minmax(0, 1fr))`,
        },
        gap: 1,
        width: "100%",
        bgcolor: "transparent",
        border: 0,
        p: 0,
      }}
    >
      {includeAllOption && (
        <ToggleButton value="ALL" sx={gamePillSx("#34D399")}>
          <Box
            component="span"
            sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
          >
            {t("gameSelector.allGames")}
          </Box>
        </ToggleButton>
      )}
      {Object.entries(GAMES_CONFIG).map(([key, game]) => {
        const activeColor = ACTIVE_COLORS[key] ?? "#34D399";
        return (
          <ToggleButton key={key} value={key} sx={gamePillSx(activeColor)}>
            <Box
              component="span"
              sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
            >
              <Box
                component="span"
                sx={{
                  display: { xs: "inline", sm: "none" },
                  whiteSpace: "nowrap",
                }}
              >
                {game.shortName ?? game.name}
              </Box>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                {game.name}
              </Box>
            </Box>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
