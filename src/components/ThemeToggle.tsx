"use client";

import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useThemeMode } from "@/lib/theme/ThemeModeContext";
import type { ThemeMode } from "@/lib/theme";

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  const { t } = useTranslation();

  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      size="small"
      aria-label={t("settings.theme.label")}
      onChange={(_event, next: ThemeMode | null) => {
        if (next !== null) setMode(next);
      }}
    >
      <ToggleButton value="light" aria-label={t("settings.theme.light")}>
        <Sun className="h-4 w-4" />
      </ToggleButton>
      <ToggleButton value="dark" aria-label={t("settings.theme.dark")}>
        <Moon className="h-4 w-4" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
