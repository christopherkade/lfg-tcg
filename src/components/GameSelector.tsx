"use client";

import Image from "next/image";
import { Box, Tooltip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { Theme } from "@mui/material/styles";
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
  return (theme: Theme) => ({
    position: "relative",
    overflow: "hidden",
    borderRadius: "10px !important",
    border: "1px solid",
    borderColor: `${theme.palette.divider} !important`,
    bgcolor: theme.palette.background.paper,
    color: theme.palette.mode === "dark" ? "#d4d4d8" : "#52525b",
    minWidth: 0,
    p: 0,
    height: { xs: 44, sm: 56 },
    "&.Mui-selected": {
      borderColor: `${activeColor}4d !important`,
      bgcolor: `${activeColor}1a`,
      color: activeColor,
    },
    "&.Mui-selected:hover": {
      bgcolor: `${activeColor}26`,
    },
  });
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
        // MUI's default ToggleButtonGroup styling assumes a linear
        // row/column layout: it shifts every non-first button 1px left
        // (to overlap shared borders) and rounds only the outer corners.
        // Neither applies to this CSS grid, so it just shunts each pill
        // 1px off its cell and clips its left border. Reset the box model
        // only — border color for every state is forced via `!important`
        // in gamePillSx, so it isn't affected by this reset.
        "& .MuiToggleButtonGroup-grouped": {
          marginLeft: "0 !important",
          borderRadius: "10px !important",
        },
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
          <Tooltip key={key} title={game.name} enterTouchDelay={0}>
            <ToggleButton value={key} sx={gamePillSx(activeColor)}>
              {/* A white chip filling the button behind the logo: brand
                  logos ship on an opaque white (or transparent) background,
                  so this keeps every logo legible regardless of the pill's
                  own tint. Inset by 1px so it sits inside the pill border. */}
              <Box
                sx={{
                  position: "absolute",
                  inset: "1px",
                  bgcolor: "#ffffff",
                  borderRadius: "9px",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={game.logo}
                  alt={game.name}
                  fill
                  sizes="200px"
                  style={{ objectFit: "contain", padding: "6px 10px" }}
                />
              </Box>
            </ToggleButton>
          </Tooltip>
        );
      })}
    </ToggleButtonGroup>
  );
}
