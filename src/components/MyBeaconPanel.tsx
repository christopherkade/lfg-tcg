"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { format, isToday } from "date-fns";
import { Alert, Button } from "@mui/material";
import { respondToJoin } from "@/app/actions/joins";
import { markBeaconMatched } from "@/app/actions/beacons";
import { ConfirmMarkMatchedDialog } from "@/components/ConfirmMarkMatchedDialog";
import { LfgDialog } from "@/components/LfgDialog";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import type { BeaconWithRelations } from "@/types/database";

interface MyBeaconPanelProps {
  beacon: BeaconWithRelations;
}

export function MyBeaconPanel({ beacon }: MyBeaconPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmMatchedOpen, setConfirmMatchedOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const pendingRequests = beacon.beacon_joins.filter(
    (join) => join.status === "PENDING",
  );
  const acceptedMembers = beacon.beacon_joins.filter(
    (join) => join.status === "ACCEPTED",
  );
  const isFull = acceptedMembers.length + 1 >= beacon.max_players;
  const game = GAMES_CONFIG[beacon.game_key];
  const scheduledDate = new Date(beacon.scheduled_at ?? beacon.created_at);
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
    }
    setPendingId(null);
  }

  async function handleMarkMatched() {
    setPendingId(beacon.id);
    setError(null);
    const result = await markBeaconMatched(beacon.id);
    if (result.error) {
      setError(result.error);
    }
    setPendingId(null);
    if (!result.error) {
      setConfirmMatchedOpen(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-50">Your Beacon</h2>
        <span className="text-sm text-zinc-400">
          {acceptedMembers.length + 1}/{beacon.max_players} players
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm text-zinc-300">
        <div className="flex justify-between">
          <span className="text-zinc-500">Game</span>
          <span>{game?.name ?? beacon.game_key}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Format</span>
          <span>{beacon.format_key}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Playstyle</span>
          <span className="capitalize">{beacon.playstyle_key}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Match Type</span>
          <span>{beacon.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">When</span>
          <span>{scheduledLabel}</span>
        </div>
        {beacon.location_name && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Location</span>
            <span>{beacon.location_name}</span>
          </div>
        )}
        {beacon.power_tiers && beacon.power_tiers.length > 0 && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Power Bracket</span>
            <span>{beacon.power_tiers.join(", ")}</span>
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
                <span className="text-zinc-50">{join.profiles.username}</span>
                <span className="text-sm text-zinc-400">
                  {join.profiles.discord_handle}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => copyText(join.id, join.profiles.discord_handle)}
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

      {beacon.notes && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-400">Your Notes</span>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">
            {beacon.notes}
          </p>
        </div>
      )}

      {pendingRequests.length > 0 && (
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
      )}

      {pendingRequests.length === 0 && acceptedMembers.length === 0 && (
        <p className="text-sm text-zinc-500">
          No one has requested to join yet. Your beacon is live in the match
          feed.
        </p>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          onClick={() => setEditOpen(true)}
          variant="outlined"
          size="small"
          sx={{ borderColor: "#27272a", color: "#d4d4d8" }}
        >
          Edit Beacon
        </Button>
        <Button
          type="button"
          onClick={() => setConfirmMatchedOpen(true)}
          disabled={pendingId === beacon.id || acceptedMembers.length === 0}
          variant="contained"
          size="small"
        >
          Mark as Matched
        </Button>
      </div>

      <ConfirmMarkMatchedDialog
        open={confirmMatchedOpen}
        onClose={() => setConfirmMatchedOpen(false)}
        onConfirm={handleMarkMatched}
        pending={pendingId === beacon.id}
        error={error}
      />

      <LfgDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setEditOpen(false)}
        profile={beacon.profiles}
        editBeacon={beacon}
      />
    </div>
  );
}
