"use client";

import { motion } from "framer-motion";
import { AtSign, MapPin, X } from "lucide-react";
import { Avatar, Box, CircularProgress, IconButton, Typography, useTheme } from "@mui/material";
import { CITY_MAP } from "@/constants/citiesConfig";
import { ProfileStats } from "@/components/ProfileStats";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { PublicProfileData } from "@/lib/profile/fetchPublicProfile";

interface UserProfilePanelProps {
  data: PublicProfileData | null; // null while loading
  onClose: () => void;
}

// Matches PodDetailDialog/PodHistoryDetailDialog's own transition so the
// close-then-open sequencing (see those dialogs' onExitComplete) feels like
// one continuous motion rather than two differently-timed animations.
const PANEL_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

export function UserProfilePanel({ data, onClose }: UserProfilePanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cityLabel = data?.profile.city ? CITY_MAP[data.profile.city]?.label : null;

  const panel = (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={PANEL_TRANSITION}
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col gap-6 overflow-y-auto p-6"
      style={{
        borderLeft: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <IconButton
        onClick={onClose}
        aria-label={t("userProfilePanel.close")}
        size="small"
        className="self-end"
        sx={{ color: "text.secondary" }}
      >
        <X className="h-5 w-5" />
      </IconButton>

      {!data ? (
        <Box className="flex flex-1 items-center justify-center">
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar
              src={data.profile.avatar_url ?? undefined}
              sx={{ width: 64, height: 64, fontSize: "1.5rem" }}
            >
              {data.profile.username[0]?.toUpperCase()}
            </Avatar>
            <div className="flex flex-col items-center gap-0.5">
              <Typography
                component="h1"
                className="truncate"
                sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}
              >
                {data.profile.username}
              </Typography>
              <Box sx={{ color: "text.secondary" }} className="flex items-center gap-1">
                <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <Typography sx={{ fontSize: "0.875rem", color: "inherit" }}>
                  {data.profile.discord_handle}
                </Typography>
              </Box>
              {cityLabel && (
                <Box sx={{ color: "text.secondary" }} className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <Typography sx={{ fontSize: "0.875rem", color: "inherit" }}>
                    {cityLabel}
                  </Typography>
                </Box>
              )}
            </div>
          </div>

          <ProfileStats
            gamesPlayedCount={data.gamesPlayedCount}
            peopleMet={data.stats.people_met}
            irlCount={data.stats.irl_count}
            onlineCount={data.stats.online_count}
          />
        </>
      )}
    </motion.div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={PANEL_TRANSITION}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60"
      />
      {panel}
    </>
  );
}
