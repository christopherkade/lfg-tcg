"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Alert, Avatar, Button, Chip, useTheme } from "@mui/material";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { PodWithRelations } from "@/types/database";

interface PodDetailDialogProps {
  pod: PodWithRelations | null;
  currentUserId: string;
  onClose: () => void;
  onRequestJoin: (podId: string) => void;
  onLeave: (podId: string) => void;
  pending: boolean;
  error: string | null;
}

export function PodDetailDialog({
  pod,
  currentUserId,
  onClose,
  onRequestJoin,
  onLeave,
  pending,
  error,
}: PodDetailDialogProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const acceptedMembers = pod?.pod_joins.filter(
    (join) => join.status === "ACCEPTED",
  );
  const ownJoin = pod?.pod_joins.find((join) => join.user_id === currentUserId);
  const isFull =
    pod != null && (acceptedMembers?.length ?? 0) + 1 >= pod.max_players;
  const game = pod ? GAMES_CONFIG[pod.game_key] : undefined;
  const scheduledLabel = pod ? formatPodWhen(pod, locale, t) : null;

  return (
    <AnimatePresence>
      {pod && (
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
              <div className="flex items-center gap-3">
                <Avatar
                  src={pod.profiles.avatar_url ?? undefined}
                  sx={{ width: 40, height: 40 }}
                >
                  {pod.profiles.username[0]?.toUpperCase()}
                </Avatar>
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>
                    {pod.profiles.username}
                  </h2>
                  <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                    {pod.profiles.discord_handle}
                  </span>
                </div>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.secondary,
                }}
              >
                {acceptedMembers ? acceptedMembers.length + 1 : 1}/
                {pod.max_players}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-sm" style={{ color: theme.palette.text.primary }}>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.game")}</span>
                <span>{game?.name ?? pod.game_key}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.format")}</span>
                <span>{t(`format.${pod.format_key}` as TranslationKey)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.playstyle")}</span>
                <span className="capitalize">
                  {t(`playstyle.${pod.playstyle_key}` as TranslationKey)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.matchType")}</span>
                <span>
                  {pod.type === "IRL"
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
              {pod.location_name && (
                <div className="flex justify-between">
                  <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.location")}</span>
                  <span>
                    {pod.location_name}
                    {pod.city && CITY_MAP[pod.city]
                      ? ` (${CITY_MAP[pod.city].label})`
                      : ""}
                  </span>
                </div>
              )}
              {pod.power_tiers && pod.power_tiers.length > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: theme.palette.text.secondary }}>{t("podDetailDialog.powerBracket")}</span>
                  <span>{pod.power_tiers.join(", ")}</span>
                </div>
              )}
            </div>

            {pod.notes && (
              <div className="flex flex-col gap-1 pt-3" style={{ borderTop: `1px solid ${theme.palette.divider}` }}>
                <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
                  {t("podDetailDialog.notes")}
                </span>
                <p className="whitespace-pre-wrap text-sm" style={{ color: theme.palette.text.primary }}>
                  {pod.notes}
                </p>
              </div>
            )}

            {acceptedMembers && acceptedMembers.length > 0 && (
              <div className="flex flex-col gap-2 pt-3" style={{ borderTop: `1px solid ${theme.palette.divider}` }}>
                <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
                  {t("podDetailDialog.groupMembers")}
                </span>
                {acceptedMembers.map((join) => (
                  <div
                    key={join.id}
                    className="flex items-center justify-between text-sm"
                    style={{ color: theme.palette.text.primary }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={join.profiles.avatar_url ?? undefined}
                        sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                      >
                        {join.profiles.username[0]?.toUpperCase()}
                      </Avatar>
                      <span>{join.profiles.username}</span>
                    </div>
                    <span style={{ color: theme.palette.text.secondary }}>
                      {join.profiles.discord_handle}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && <Alert severity="error">{error}</Alert>}

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
              {ownJoin ? (
                ownJoin.status === "REJECTED" ? (
                  <Chip
                    label={t("podDetailDialog.requestRejected")}
                    sx={{
                      flex: 1,
                      height: "auto",
                      py: 1.5,
                      borderRadius: 9999,
                      bgcolor: "divider",
                      color: "text.secondary",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}
                  />
                ) : (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => onLeave(pod.id)}
                    variant="outlined"
                    fullWidth
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
                    {pending
                      ? t("podDetailDialog.leaving")
                      : ownJoin.status === "PENDING"
                        ? t("podDetailDialog.cancelRequest")
                        : t("podDetailDialog.leave")}
                  </Button>
                )
              ) : (
                <Button
                  type="button"
                  disabled={pending || isFull}
                  onClick={() => onRequestJoin(pod.id)}
                  variant="contained"
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  {isFull
                    ? t("podDetailDialog.full")
                    : pending
                      ? t("podDetailDialog.requesting")
                      : t("podDetailDialog.requestToJoin")}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
