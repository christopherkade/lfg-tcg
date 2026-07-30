"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, useTheme } from "@mui/material";
import { Trash2 } from "lucide-react";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useUserProfilePanel } from "@/lib/UserProfilePanelContext";
import type { TranslationKey } from "@/lib/i18n";
import type { PodHistoryEntryWithHost } from "@/components/HistoryList";

interface PodHistoryDetailDialogProps {
  entry: PodHistoryEntryWithHost | null;
  onClose: () => void;
  onDelete: (entryId: string) => void;
}

export function PodHistoryDetailDialog({
  entry,
  onClose,
  onDelete,
}: PodHistoryDetailDialogProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const { openUserProfile } = useUserProfilePanel();
  // Same close-then-open sequencing as PodDetailDialog: closing this dialog
  // must finish its own exit animation before the profile panel opens.
  const [pendingProfileUsername, setPendingProfileUsername] = useState<
    string | null
  >(null);

  function handleViewProfile(username: string) {
    setPendingProfileUsername(username);
    onClose();
  }

  const game = entry ? GAMES_CONFIG[entry.game_key] : undefined;
  const scheduledLabel = entry
    ? formatPodWhen(
        { scheduled_at: entry.scheduled_at, created_at: entry.pod_created_at },
        locale,
        t,
      )
    : null;

  return (
    <AnimatePresence
      onExitComplete={() => {
        if (pendingProfileUsername) {
          openUserProfile(pendingProfileUsername);
          setPendingProfileUsername(null);
        }
      }}
    >
      {entry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 sm:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl p-6"
            style={{
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                onClick={() => handleViewProfile(entry.host.username)}
                aria-label={t("userProfilePanel.viewProfile", {
                  username: entry.host.username,
                })}
                className="group flex items-center gap-3 text-left"
              >
                <Avatar
                  src={entry.host.avatar_url ?? undefined}
                  sx={{ width: 40, height: 40 }}
                >
                  {entry.host.username[0]?.toUpperCase()}
                </Avatar>
                <div className="flex flex-col">
                  <h2
                    className="text-lg font-semibold group-hover:underline group-focus-visible:underline"
                    style={{ color: theme.palette.text.primary }}
                  >
                    {entry.host.username}
                  </h2>
                  <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                    {entry.host.discord_handle}
                  </span>
                </div>
              </button>
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.secondary,
                }}
              >
                {t("podDetailDialog.playersCountTotal", {
                  count: entry.members.length + 1,
                })}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-sm" style={{ color: theme.palette.text.primary }}>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.game")}</span>
                <span>{game?.name ?? entry.game_key}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.format")}</span>
                <span>{t(`format.${entry.format_key}` as TranslationKey)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.playstyle")}</span>
                <span className="capitalize">
                  {t(`playstyle.${entry.playstyle_key}` as TranslationKey)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.matchType")}</span>
                <span>
                  {entry.type === "IRL"
                    ? t("podFilters.matchTypeIrl")
                    : t("podFilters.matchTypeOnline")}
                </span>
              </div>
              {scheduledLabel && (
                <div className="flex justify-between">
                  <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.when")}</span>
                  <span>{scheduledLabel}</span>
                </div>
              )}
              {entry.location_name && (
                <div className="flex justify-between">
                  <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.location")}</span>
                  <span>
                    {entry.location_name}
                    {entry.city && CITY_MAP[entry.city]
                      ? ` (${CITY_MAP[entry.city].label})`
                      : ""}
                  </span>
                </div>
              )}
              {entry.power_tiers && entry.power_tiers.length > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.powerBracket")}</span>
                  <span>{entry.power_tiers.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3" style={{ borderTop: `1px solid ${theme.palette.divider}` }}>
              <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
                {t("podDetailDialog.groupMembers")}
              </span>
              <div className="flex items-center justify-between text-sm" style={{ color: theme.palette.text.primary }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewProfile(entry.host.username)}
                    aria-label={t("userProfilePanel.viewProfile", {
                      username: entry.host.username,
                    })}
                    className="group flex items-center gap-2 text-left"
                  >
                    <Avatar
                      src={entry.host.avatar_url ?? undefined}
                      sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                    >
                      {entry.host.username[0]?.toUpperCase()}
                    </Avatar>
                    <span className="group-hover:underline group-focus-visible:underline">
                      {entry.host.username}
                    </span>
                  </button>
                  <span style={{ color: theme.palette.text.secondary }}>
                    ({t("historyPage.host")})
                  </span>
                </div>
                <span style={{ color: theme.palette.text.secondary }}>
                  {entry.host.discord_handle}
                </span>
              </div>
              {entry.members.map((member) => {
                // A deleted account's snapshot here has discord_handle: ""
                // (supabase/sql/account_deletion.sql's anonymization) — a
                // live profile's handle can never be empty (NOT NULL,
                // Discord-synced), so this is a reliable "no profile to
                // view" signal, unlike checking the username text itself.
                const isLive = Boolean(member.discord_handle);
                const avatar = (
                  <Avatar
                    src={member.avatar_url ?? undefined}
                    sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                  >
                    {member.username[0]?.toUpperCase()}
                  </Avatar>
                );

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between text-sm"
                    style={{ color: theme.palette.text.primary }}
                  >
                    {isLive ? (
                      <button
                        type="button"
                        onClick={() => handleViewProfile(member.username)}
                        aria-label={t("userProfilePanel.viewProfile", {
                          username: member.username,
                        })}
                        className="group flex items-center gap-2 text-left"
                      >
                        {avatar}
                        <span className="group-hover:underline group-focus-visible:underline">
                          {member.username}
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {avatar}
                        <span>{member.username}</span>
                      </div>
                    )}
                    <span style={{ color: theme.palette.text.secondary }}>
                      {member.discord_handle}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outlined"
                fullWidth
                sx={{ py: 1.5, borderColor: "divider", color: "text.secondary" }}
              >
                {t("podDetailDialog.close")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onDelete(entry.id);
                  onClose();
                }}
                variant="outlined"
                fullWidth
                startIcon={<Trash2 className="h-4 w-4" />}
                sx={{
                  py: 1.5,
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  "&:hover": {
                    borderColor: "#ef4444",
                    bgcolor: "rgba(239, 68, 68, 0.1)",
                  },
                }}
              >
                {t("historyPage.delete")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
