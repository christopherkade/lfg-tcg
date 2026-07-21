"use client";

import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { PLAYSTYLE_OPTIONS } from "@/constants/gamesConfig";
import type { PlaystyleKey } from "@/types/database";

interface PlaystyleToggleProps {
  value: PlaystyleKey;
  onChange: (playstyle: PlaystyleKey) => void;
}

export function PlaystyleToggle({ value, onChange }: PlaystyleToggleProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      fullWidth
      onChange={(_event, next) => {
        if (next !== null) {
          onChange(next);
        }
      }}
    >
      {PLAYSTYLE_OPTIONS.map((option) => (
        <ToggleButton key={option.key} value={option.key}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
