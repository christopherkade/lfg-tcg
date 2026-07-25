"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import {
  CircleHelp,
  UserCircle,
  Zap,
  Users,
  Bell,
  Handshake,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";

interface Step {
  icon: LucideIcon;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

const STEPS: Step[] = [
  { icon: UserCircle, titleKey: "tutorial.step1.title", bodyKey: "tutorial.step1.body" },
  { icon: Zap, titleKey: "tutorial.step2.title", bodyKey: "tutorial.step2.body" },
  { icon: Users, titleKey: "tutorial.step3.title", bodyKey: "tutorial.step3.body" },
  { icon: Bell, titleKey: "tutorial.step4.title", bodyKey: "tutorial.step4.body" },
  { icon: Handshake, titleKey: "tutorial.step5.title", bodyKey: "tutorial.step5.body" },
];

export function TutorialDialog() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        aria-label={t("tutorial.buttonLabel")}
        sx={{ color: "text.primary" }}
      >
        <CircleHelp className="h-5 w-5" />
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
          {t("tutorial.title")}
          <IconButton
            onClick={() => setOpen(false)}
            size="small"
            sx={{ color: "text.primary", "&:hover": { color: "text.secondary" } }}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <div className="flex flex-col gap-4 pb-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.titleKey} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div className="flex flex-col gap-0.5">
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: "text.primary",
                      }}
                    >
                      {t(step.titleKey)}
                    </Typography>
                    <Typography
                      sx={{ fontSize: "0.8125rem", color: "text.secondary" }}
                    >
                      {t(step.bodyKey)}
                    </Typography>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
