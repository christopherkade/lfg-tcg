"use client";

import { MenuItem, TextField } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <TextField
      select
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
      label={t("localeSwitcher.label")}
      size="small"
      fullWidth
    >
      <MenuItem value="en">English</MenuItem>
      <MenuItem value="fr">Français</MenuItem>
    </TextField>
  );
}
