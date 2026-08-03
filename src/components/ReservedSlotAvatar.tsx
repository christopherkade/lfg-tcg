"use client";

import { UserRound } from "lucide-react";
import { Avatar, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface ReservedSlotAvatarProps {
  size?: number;
}

/**
 * Dashed placeholder avatar representing a pod seat the host already
 * filled with someone outside the app (see pods.reserved_slots). Rendered
 * alongside real accepted-member avatars so the pod visually reads as
 * "N/max" full without a real pod_joins row existing for that seat.
 */
export function ReservedSlotAvatar({ size = 32 }: ReservedSlotAvatarProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tooltip title={t("podDetailDialog.reservedSlotTooltip")}>
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: "transparent",
          color: theme.palette.text.secondary,
          border: `1px dashed ${theme.palette.divider}`,
        }}
      >
        <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />
      </Avatar>
    </Tooltip>
  );
}
