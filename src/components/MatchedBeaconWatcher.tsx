"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchedDialog } from "@/components/MatchedDialog";

interface MatchedBeaconWatcherProps {
  currentUserId: string;
}

/**
 * Watches for the current user's own accepted beacon transitioning to
 * MATCHED, surfacing a blocking `MatchedDialog` (see that component for why
 * this is a dialog rather than a dismissable toast — it's the only cue an
 * accepted member gets before the card vanishes from every match-feed
 * query). Deliberately separate from `NotificationBell`: a MATCHED
 * transition isn't one of the persisted notification types (join request /
 * accepted / rejected / member left / beacon updated) — it already has its
 * own dedicated blocking UX and isn't part of the notification history.
 *
 * This component previously also handled join-request/accepted toasts
 * (as `JoinRequestNotifier`); that responsibility has moved to
 * `NotificationBell`, which is driven off the persisted `notifications`
 * table instead of listening to `beacons`/`beacon_joins` directly — avoids
 * two independent realtime listeners racing to announce the same event.
 *
 * Single long-lived subscription for the component's lifetime (mounted
 * once in the (app) layout), mirroring the "no server-side filter +
 * client-side match" realtime pattern used elsewhere in this codebase.
 */
export function MatchedBeaconWatcher({
  currentUserId,
}: MatchedBeaconWatcherProps) {
  const [matchedDialogOpen, setMatchedDialogOpen] = useState(false);
  // Guards against re-showing the dialog for a beacon already surfaced
  // within this mount.
  const notifiedBeaconIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`matched-beacon-watcher-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "beacons" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            user_id: string;
          };
          // The host already knows — they're the one who marked it
          // matched. This dialog is for the people who joined them.
          if (
            row.status !== "MATCHED" ||
            row.user_id === currentUserId ||
            notifiedBeaconIdsRef.current.has(row.id)
          ) {
            return;
          }

          const { data: ownJoin, error: ownJoinError } = await supabase
            .from("beacon_joins")
            .select("id")
            .eq("beacon_id", row.id)
            .eq("user_id", currentUserId)
            .eq("status", "ACCEPTED")
            .maybeSingle();

          if (ownJoinError) {
            console.error(
              "[MatchedBeaconWatcher] failed to check own join for MATCHED beacon:",
              ownJoinError,
            );
          }

          if (ownJoin) {
            notifiedBeaconIdsRef.current.add(row.id);
            setMatchedDialogOpen(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <MatchedDialog
      open={matchedDialogOpen}
      onClose={() => setMatchedDialogOpen(false)}
    />
  );
}
