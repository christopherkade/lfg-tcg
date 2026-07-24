"use client";

import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { PLAYSTYLE_OPTIONS } from "@/constants/gamesConfig";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { PlaystyleKey } from "@/types/database";

interface PlaystyleToggleProps {
  value: PlaystyleKey;
  onChange: (playstyle: PlaystyleKey) => void;
}

export function PlaystyleToggle({ value, onChange }: PlaystyleToggleProps) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      fullWidth
      size="small"
      onChange={(_event, next) => {
        if (next !== null) {
          onChange(next);
        }
      }}
    >
      {PLAYSTYLE_OPTIONS.map((option) => (
        <ToggleButton key={option.key} value={option.key}>
          {t(`playstyle.${option.key}` as TranslationKey)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
