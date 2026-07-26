"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, UserX, X } from "lucide-react";
import { Alert, Avatar, Button, useTheme } from "@mui/material";
import { removeMember, respondToJoin } from "@/app/actions/joins";
import { markPodMatched } from "@/app/actions/pods";
import { openDiscordAddFriend } from "@/lib/discord";
import { ConfirmMarkMatchedDialog } from "@/components/ConfirmMarkMatchedDialog";
import { ConfirmRemoveMemberDialog } from "@/components/ConfirmRemoveMemberDialog";
import { LfgDialog } from "@/components/LfgDialog";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { PodJoinWithProfile, PodWithRelations } from "@/types/database";

interface MyPodPanelProps {
  pod: PodWithRelations;
  onChanged?: () => void;
  /** Briefly pulses the panel's border/glow — used right after pod creation. */
  highlight?: boolean;
}

export function MyPodPanel({ pod, onChanged, highlight = false }: MyPodPanelProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmMatchedOpen, setConfirmMatchedOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PodJoinWithProfile | null>(
    null,
  );
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState(false);

  const pendingRequests = pod.pod_joins.filter(
    (join) => join.status === "PENDING",
  );
  const acceptedMembers = pod.pod_joins.filter(
    (join) => join.status === "ACCEPTED",
  );
  const isFull = acceptedMembers.length + 1 >= pod.max_players;
  const game = GAMES_CONFIG[pod.game_key];
  const scheduledLabel = formatPodWhen(pod, locale, t);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API unavailable/denied — the handles are still visible
      // to copy manually.
    }
  }

  async function addOnDiscord(key: string, handle: string) {
    await copyText(key, handle);
    openDiscordAddFriend();
  }

  async function handleRespond(
    joinId: string,
    decision: "ACCEPTED" | "REJECTED",
  ) {
    setPendingId(joinId);
    setError(null);
    const result = await respondToJoin(joinId, decision);
    if (result.error) {
      setError(result.error);
    } else {
      // Don't rely solely on the realtime subscription to reflect this —
      // postgres_changes delivery is known-unreliable in this project (see
      // repo memory), which left the request stuck showing Accept/Reject
      // even though the DB row had already been updated. Refetch
      // immediately on success instead.
      onChanged?.();
    }
    setPendingId(null);
  }

  async function handleMarkMatched() {
    setPendingId(pod.id);
    setError(null);
    const result = await markPodMatched(pod.id);
    if (result.error) {
      setError(result.error);
    }
    setPendingId(null);
    if (!result.error) {
      setConfirmMatchedOpen(false);
      onChanged?.();
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) {
      return;
    }
    setRemovePending(true);
    setRemoveError(null);
    const result = await removeMember(removeTarget.id);
    if (result.error) {
      setRemoveError(result.error);
    }
    setRemovePending(false);
    if (!result.error) {
      setRemoveTarget(null);
      onChanged?.();
    }
  }

  return (
    <motion.div
      animate={
        highlight
          ? {
              boxShadow: [
                "0 0 0 0 rgba(129, 140, 248, 0)",
                "0 0 0 6px rgba(129, 140, 248, 0.2)",
              ],
            }
          : { boxShadow: "0 0 0 0 rgba(129, 140, 248, 0)" }
      }
      transition={
        highlight
          ? {
              duration: 0.9,
              repeat: 3,
              repeatType: "reverse",
              ease: "easeInOut",
            }
          : { duration: 0.4 }
      }
      className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-indigo-500/50 p-5"
      style={{ backgroundColor: theme.palette.background.paper }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>
            {t("myPodPanel.title")}
          </h2>
          {pendingRequests.length > 0 && (
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {pendingRequests.length === 1
                ? t("myPodPanel.joinRequestCount", { count: pendingRequests.length })
                : t("myPodPanel.joinRequestCountPlural", { count: pendingRequests.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
            {t("myPodPanel.playersCount", {
              count: acceptedMembers.length + 1,
              max: pod.max_players,
            })}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            style={{ color: theme.palette.text.secondary }}
          />
        </div>
      </button>

      {pendingRequests.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
            {t("myPodPanel.joinRequests")}
          </span>
          {pendingRequests.map((join) => (
            <div
              key={join.id}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ border: `1px solid ${theme.palette.divider}` }}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={join.profiles.avatar_url ?? undefined}
                  sx={{ width: 32, height: 32 }}
                >
                  {join.profiles.username[0]?.toUpperCase()}
                </Avatar>
                <div className="flex flex-col">
                  <span style={{ color: theme.palette.text.primary }}>
                    {join.profiles.username}
                  </span>
                  <span className="text-xs" style={{ color: theme.palette.text.secondary }}>
                    {join.profiles.discord_handle}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={pendingId === join.id || isFull}
                  onClick={() => handleRespond(join.id, "ACCEPTED")}
                  size="small"
                  startIcon={<Check className="h-4 w-4" />}
                  sx={{
                    bgcolor: "rgba(16, 185, 129, 0.1)",
                    color: "#34d399",
                    minWidth: "auto",
                    px: 1.5,
                    "&:hover": { bgcolor: "rgba(16, 185, 129, 0.2)" },
                    "&.Mui-disabled": { color: "#34d399", opacity: 0.4 },
                  }}
                >
                  {t("myPodPanel.accept")}
                </Button>
                <Button
                  type="button"
                  disabled={pendingId === join.id}
                  onClick={() => handleRespond(join.id, "REJECTED")}
                  size="small"
                  startIcon={<X className="h-4 w-4" />}
                  sx={{
                    bgcolor: "rgba(239, 68, 68, 0.1)",
                    color: "#f87171",
                    minWidth: "auto",
                    px: 1.5,
                    "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)" },
                    "&.Mui-disabled": { color: "#f87171", opacity: 0.4 },
                  }}
                >
                  {t("myPodPanel.reject")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: theme.palette.text.secondary }}>
          {t("myPodPanel.noRequests")}
        </p>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {expanded && (
        <>
          <div className="flex flex-col gap-2 text-sm" style={{ color: theme.palette.text.primary }}>
            <div className="flex justify-between">
              <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.game")}</span>
              <span>{game?.name ?? pod.game_key}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.format")}</span>
              <span>{t(`format.${pod.format_key}` as TranslationKey)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.playstyle")}</span>
              <span className="capitalize">
                {t(`playstyle.${pod.playstyle_key}` as TranslationKey)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.matchType")}</span>
              <span>
                {pod.type === "IRL"
                  ? t("podFilters.matchTypeIrl")
                  : t("podFilters.matchTypeOnline")}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.when")}</span>
              <span>{scheduledLabel}</span>
            </div>
            {pod.location_name && (
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.location")}</span>
                <span>{pod.location_name}</span>
              </div>
            )}
            {pod.power_tiers && pod.power_tiers.length > 0 && (
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>{t("myPodPanel.powerBracket")}</span>
                <span>{pod.power_tiers.join(", ")}</span>
              </div>
            )}
          </div>

          {acceptedMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
                {t("myPodPanel.groupMembers")}
              </span>
              {acceptedMembers.map((join) => (
                <div
                  key={join.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ border: `1px solid ${theme.palette.divider}` }}
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={join.profiles.avatar_url ?? undefined}
                      sx={{ width: 32, height: 32 }}
                    >
                      {join.profiles.username[0]?.toUpperCase()}
                    </Avatar>
                    <div className="flex flex-col">
                      <span style={{ color: theme.palette.text.primary }}>
                        {join.profiles.username}
                      </span>
                      <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                        {join.profiles.discord_handle}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        addOnDiscord(join.id, join.profiles.discord_handle)
                      }
                      size="small"
                      startIcon={
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={copied === join.id ? "check" : "copy"}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="inline-flex"
                          >
                            {copied === join.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </motion.span>
                        </AnimatePresence>
                      }
                      sx={{
                        flexShrink: 0,
                        px: 1.5,
                        py: 0.75,
                        fontSize: "0.75rem",
                        bgcolor: "rgba(99, 102, 241, 0.1)",
                        color: "#a5b4fc",
                        "&:hover": { bgcolor: "rgba(99, 102, 241, 0.2)" },
                      }}
                    >
                      {copied === join.id ? t("myPodPanel.copied") : t("myPodPanel.addOnDiscord")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoveTarget(join);
                      }}
                      size="small"
                      startIcon={<UserX className="h-3.5 w-3.5" />}
                      sx={{
                        flexShrink: 0,
                        px: 1.5,
                        py: 0.75,
                        fontSize: "0.75rem",
                        bgcolor: "rgba(239, 68, 68, 0.1)",
                        color: "#f87171",
                        "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)" },
                      }}
                    >
                      {t("myPodPanel.remove")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pod.notes && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: theme.palette.text.secondary }}>
                {t("myPodPanel.yourNotes")}
              </span>
              <p className="whitespace-pre-wrap text-sm" style={{ color: theme.palette.text.primary }}>
                {pod.notes}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() =>
                copyText("__link__", `${window.location.origin}/pods/${pod.id}`)
              }
              variant="outlined"
              size="small"
              startIcon={
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied === "__link__" ? "check" : "copy"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="inline-flex"
                  >
                    {copied === "__link__" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </motion.span>
                </AnimatePresence>
              }
              sx={{ borderColor: "divider", color: "text.secondary" }}
            >
              {copied === "__link__" ? t("myPodPanel.copied") : t("myPodPanel.copyLink")}
            </Button>
            <Button
              type="button"
              onClick={() => setEditOpen(true)}
              variant="outlined"
              size="small"
              sx={{ borderColor: "divider", color: "text.secondary" }}
            >
              {t("myPodPanel.editPod")}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmMatchedOpen(true)}
              disabled={pendingId === pod.id || acceptedMembers.length === 0}
              variant="contained"
              size="small"
            >
              {t("myPodPanel.markAsMatched")}
            </Button>
          </div>
        </>
      )}

      <ConfirmMarkMatchedDialog
        open={confirmMatchedOpen}
        onClose={() => setConfirmMatchedOpen(false)}
        onConfirm={handleMarkMatched}
        pending={pendingId === pod.id}
        error={error}
      />

      <ConfirmRemoveMemberDialog
        open={removeTarget !== null}
        memberName={removeTarget?.profiles.username ?? null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        pending={removePending}
        error={removeError}
      />

      <LfgDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          setEditOpen(false);
          onChanged?.();
        }}
        profile={pod.profiles}
        editPod={pod}
      />
    </motion.div>
  );
}
