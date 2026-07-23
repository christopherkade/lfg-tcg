"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, UserX, X } from "lucide-react";
import { format, isToday } from "date-fns";
import { Alert, Button } from "@mui/material";
import { removeMember, respondToJoin } from "@/app/actions/joins";
import { markPodMatched } from "@/app/actions/pods";
import { ConfirmMarkMatchedDialog } from "@/components/ConfirmMarkMatchedDialog";
import { ConfirmRemoveMemberDialog } from "@/components/ConfirmRemoveMemberDialog";
import { LfgDialog } from "@/components/LfgDialog";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import type { PodJoinWithProfile, PodWithRelations } from "@/types/database";

interface MyPodPanelProps {
  pod: PodWithRelations;
  onChanged?: () => void;
}

export function MyPodPanel({ pod, onChanged }: MyPodPanelProps) {
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
  const scheduledDate = new Date(pod.scheduled_at ?? pod.created_at);
  const scheduledLabel = isToday(scheduledDate)
    ? `Today, ${format(scheduledDate, "p")}`
    : format(scheduledDate, "MMM d, p");

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
    <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-indigo-500/50 bg-zinc-900 p-5">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-50">Your Pod</h2>
          {pendingRequests.length > 0 && (
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {pendingRequests.length} join request
              {pendingRequests.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            {acceptedMembers.length + 1}/{pod.max_players} players
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {pendingRequests.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-400">
            Join Requests
          </span>
          {pendingRequests.map((join) => (
            <div
              key={join.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-zinc-50">{join.profiles.username}</span>
                <span className="text-xs text-zinc-500">
                  {join.profiles.discord_handle}
                </span>
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
                    "&:hover": { bgcolor: "rgba(16, 185, 129, 0.2)" },
                    "&.Mui-disabled": { color: "#34d399", opacity: 0.4 },
                  }}
                >
                  Accept
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
                    "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)" },
                    "&.Mui-disabled": { color: "#f87171", opacity: 0.4 },
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No one has requested to join yet. Your pod is live in the match feed.
        </p>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {expanded && (
        <>
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
            <div className="flex justify-between">
              <span className="text-zinc-500">When</span>
              <span>{scheduledLabel}</span>
            </div>
            {pod.location_name && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Location</span>
                <span>{pod.location_name}</span>
              </div>
            )}
            {pod.power_tiers && pod.power_tiers.length > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Power Bracket</span>
                <span>{pod.power_tiers.join(", ")}</span>
              </div>
            )}
          </div>

          {acceptedMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-400">
                Group Members
              </span>
              {acceptedMembers.map((join) => (
                <div
                  key={join.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-zinc-50">
                      {join.profiles.username}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {join.profiles.discord_handle}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        copyText(join.id, join.profiles.discord_handle)
                      }
                      size="small"
                      startIcon={
                        copied === join.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )
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
                      {copied === join.id ? "Copied" : "Copy Handle"}
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
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                onClick={() =>
                  copyText(
                    "__all__",
                    acceptedMembers
                      .map((join) => join.profiles.discord_handle)
                      .join(", "),
                  )
                }
                variant="outlined"
                startIcon={
                  copied === "__all__" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                sx={{ borderColor: "#27272a", color: "#d4d4d8" }}
              >
                {copied === "__all__" ? "Copied" : "Copy All Handles"}
              </Button>
            </div>
          )}

          {pod.notes && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-400">
                Your Notes
              </span>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">
                {pod.notes}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => setEditOpen(true)}
              variant="outlined"
              size="small"
              sx={{ borderColor: "#27272a", color: "#d4d4d8" }}
            >
              Edit Pod
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmMatchedOpen(true)}
              disabled={pendingId === pod.id || acceptedMembers.length === 0}
              variant="contained"
              size="small"
            >
              Mark as Matched
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
        onSuccess={() => setEditOpen(false)}
        profile={pod.profiles}
        editPod={pod}
      />
    </div>
  );
}
