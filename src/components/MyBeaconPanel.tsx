"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { respondToJoin } from "@/app/actions/joins";
import { markBeaconMatched } from "@/app/actions/beacons";
import { ConfirmMarkMatchedDialog } from "@/components/ConfirmMarkMatchedDialog";
import type { BeaconWithRelations } from "@/types/database";

interface MyBeaconPanelProps {
  beacon: BeaconWithRelations;
}

export function MyBeaconPanel({ beacon }: MyBeaconPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmMatchedOpen, setConfirmMatchedOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const pendingRequests = beacon.beacon_joins.filter(
    (join) => join.status === "PENDING",
  );
  const acceptedMembers = beacon.beacon_joins.filter(
    (join) => join.status === "ACCEPTED",
  );
  const isFull = acceptedMembers.length + 1 >= beacon.max_players;

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
              <button
                type="button"
                onClick={() => copyText(join.id, join.profiles.discord_handle)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20"
              >
                {copied === join.id ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Handle
                  </>
                )}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              copyText(
                "__all__",
                acceptedMembers
                  .map((join) => join.profiles.discord_handle)
                  .join(", "),
              )
            }
            className="flex items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700"
          >
            {copied === "__all__" ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy All Handles
              </>
            )}
          </button>
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
                <button
                  type="button"
                  disabled={pendingId === join.id || isFull}
                  onClick={() => handleRespond(join.id, "ACCEPTED")}
                  className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" /> Accept
                </button>
                <button
                  type="button"
                  disabled={pendingId === join.id}
                  onClick={() => handleRespond(join.id, "REJECTED")}
                  className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400 disabled:opacity-40"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
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

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setConfirmMatchedOpen(true)}
        disabled={pendingId === beacon.id || acceptedMembers.length === 0}
        className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40"
      >
        Mark as Matched
      </button>

      <ConfirmMarkMatchedDialog
        open={confirmMatchedOpen}
        onClose={() => setConfirmMatchedOpen(false)}
        onConfirm={handleMarkMatched}
        pending={pendingId === beacon.id}
        error={error}
      />
    </div>
  );
}
