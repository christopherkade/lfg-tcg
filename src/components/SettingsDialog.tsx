"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { Settings, X } from "lucide-react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/lib/i18n/LocaleContext";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        aria-label={t("settings.buttonLabel")}
        sx={{ color: "text.primary" }}
      >
        <Settings className="h-5 w-5" />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: (theme) => ({
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }),
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "1rem",
            fontWeight: 700,
            color: "text.primary",
          }}
        >
          {t("settings.title")}
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{ color: "text.primary", "&:hover": { color: "text.secondary" } }}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <LocaleSwitcher />
            <div className="flex items-center justify-between">
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("settings.theme.label")}
              </Typography>
              <ThemeToggle />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
