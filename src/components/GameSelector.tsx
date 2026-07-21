"use client";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { GAMES_CONFIG } from "@/constants/gamesConfig";

interface GameSelectorProps {
  value: string;
  onChange: (gameKey: string) => void;
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

export function GameSelector({ value, onChange }: GameSelectorProps) {
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
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
        gap: 1.5,
        width: "100%",
        bgcolor: "transparent",
        border: 0,
        p: 0,
      }}
    >
      {Object.entries(GAMES_CONFIG).map(([key, game]) => {
        const activeColor = ACTIVE_COLORS[key] ?? "#fafafa";
        return (
          <ToggleButton
            key={key}
            value={key}
            sx={{
              borderRadius: "12px !important",
              border: "1px solid",
              borderColor: "#27272a",
              bgcolor: "#18181b",
              color: "#a1a1aa",
              px: 1.5,
              py: 2,
              "&.Mui-selected": {
                borderColor: `${activeColor}4d`,
                bgcolor: `${activeColor}1a`,
                color: activeColor,
              },
              "&.Mui-selected:hover": {
                bgcolor: `${activeColor}26`,
              },
            }}
          >
            <Box component="span" sx={{ fontSize: "0.875rem" }}>
              {game.name}
            </Box>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
