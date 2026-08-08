"use client";

import { Typography, useTheme } from "@mui/material";
import { CITY_MAP } from "@/constants/citiesConfig";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { OrganizerApplicationWithApplicant } from "@/types/database";

interface AdminApplicationCardProps {
  application: OrganizerApplicationWithApplicant;
  onClick: () => void;
}

export function AdminApplicationCard({
  application,
  onClick,
}: AdminApplicationCardProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors"
      style={{
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
          {application.store_name}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
          {new Date(application.created_at).toLocaleDateString(locale)}
        </Typography>
      </div>
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
        {CITY_MAP[application.city]?.label ?? application.city}
      </Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
        {t("admin.applications.applicant", {
          username: application.profiles.username,
          handle: application.profiles.discord_handle,
        })}
      </Typography>
    </button>
  );
}
