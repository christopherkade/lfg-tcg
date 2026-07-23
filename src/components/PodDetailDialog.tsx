"use client";

import { AnimatePresence, motion } from "framer-motion";
import { format, isToday } from "date-fns";
import { Alert, Button, Chip } from "@mui/material";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
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
  const acceptedMembers = pod?.pod_joins.filter(
    (join) => join.status === "ACCEPTED",
  );
  const ownJoin = pod?.pod_joins.find((join) => join.user_id === currentUserId);
  const isFull =
    pod != null && (acceptedMembers?.length ?? 0) + 1 >= pod.max_players;
  const game = pod ? GAMES_CONFIG[pod.game_key] : undefined;
  const scheduledDate = pod
    ? new Date(pod.scheduled_at ?? pod.created_at)
    : null;
  const scheduledLabel = scheduledDate
    ? isToday(scheduledDate)
      ? `Today, ${format(scheduledDate, "p")}`
      : format(scheduledDate, "MMM d, p")
    : null;

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
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-zinc-50">
                  {pod.profiles.username}
                </h2>
                <span className="text-sm text-zinc-500">
                  {pod.profiles.discord_handle}
                </span>
              </div>
              <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
                {acceptedMembers ? acceptedMembers.length + 1 : 1}/
                {pod.max_players}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Game</span>
                <span>{game?.name ?? pod.game_key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Format</span>
                <span>{pod.format_key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Playstyle</span>
                <span className="capitalize">{pod.playstyle_key}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Match Type</span>
                <span>{pod.type}</span>
              </div>
              {scheduledLabel && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">When</span>
                  <span>{scheduledLabel}</span>
                </div>
              )}
              {pod.location_name && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Location</span>
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
                  <span className="text-zinc-500">Power Bracket</span>
                  <span>{pod.power_tiers.join(", ")}</span>
                </div>
              )}
            </div>

            {pod.notes && (
              <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3">
                <span className="text-sm font-medium text-zinc-400">Notes</span>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">
                  {pod.notes}
                </p>
              </div>
            )}

            {acceptedMembers && acceptedMembers.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-sm font-medium text-zinc-400">
                  Group Members
                </span>
                {acceptedMembers.map((join) => (
                  <div
                    key={join.id}
                    className="flex justify-between text-sm text-zinc-300"
                  >
                    <span>{join.profiles.username}</span>
                    <span className="text-zinc-500">
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
                sx={{ py: 1.5, borderColor: "#27272a", color: "#a1a1aa" }}
              >
                Close
              </Button>
              {ownJoin ? (
                ownJoin.status === "REJECTED" ? (
                  <Chip
                    label="Request Rejected"
                    sx={{
                      flex: 1,
                      height: "auto",
                      py: 1.5,
                      borderRadius: 9999,
                      bgcolor: "#27272a",
                      color: "#a1a1aa",
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
                      ? "Leaving..."
                      : ownJoin.status === "PENDING"
                        ? "Cancel Request"
                        : "Leave"}
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
                    ? "Full"
                    : pending
                      ? "Requesting..."
                      : "Request to Join"}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
