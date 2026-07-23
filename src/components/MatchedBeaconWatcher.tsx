"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchedDialog } from "@/components/MatchedDialog";

interface MatchedBeaconWatcherProps {
  currentUserId: string;
}

/**
 * Beacon ids the user has already been shown the MatchedDialog for,
 * persisted per-user in localStorage (mirroring LfgDialog's stored-search
 * pattern) so a page reload doesn't re-surface the dialog for a beacon
 * matched long ago — the in-memory `notifiedBeaconIdsRef` alone only
 * guards against re-showing it within the same mount.
 */
function storageKey(userId: string) {
  return `lfg-tcg:seen-matched-beacons:${userId}`;
}

function loadSeenBeaconIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSeenBeaconIds(userId: string, beaconIds: Iterable<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.from(beaconIds)),
    );
  } catch {
    // Ignore quota/serialization errors — persistence is a convenience,
    // not a requirement (worst case, the dialog re-surfaces once).
  }
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
 * Backed by an initial-load + focus/visibility + interval poll fallback
 * (see below) since the realtime event alone has been unreliable, and a
 * user waiting on this exact dialog is usually already sitting on a
 * focused tab rather than switching back to it.
 */
export function MatchedBeaconWatcher({
  currentUserId,
}: MatchedBeaconWatcherProps) {
  const [matchedDialogOpen, setMatchedDialogOpen] = useState(false);
  // Guards against re-showing the dialog for a beacon already surfaced —
  // seeded from localStorage (see storageKey above) so this also holds
  // across page reloads, not just within the current mount.
  const notifiedBeaconIdsRef = useRef<Set<string> | null>(null);
  if (notifiedBeaconIdsRef.current === null) {
    notifiedBeaconIdsRef.current = new Set(loadSeenBeaconIds(currentUserId));
  }

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Unlike MatchFeed/LfgButton/NotificationBell (whose
  // focus/visibility-only fallback is enough since their content just sits
  // there stale until next glanced at), a user waiting on this exact dialog
  // is typically staring at an already-focused tab the whole time — a
  // focus/visibility listener alone would never fire, so this also polls on
  // an interval while the tab is visible, in addition to on mount and
  // focus/visibility, so a missed UPDATE event self-heals within seconds
  // instead of requiring a manual reload.
  useEffect(() => {
    const supabase = createClient();
    const notifiedBeaconIds = notifiedBeaconIdsRef.current as Set<string>;

    async function checkForMatchedBeacons() {
      const { data, error } = await supabase
        .from("beacon_joins")
        .select("beacon_id, beacons!inner(status)")
        .eq("user_id", currentUserId)
        .eq("status", "ACCEPTED")
        .eq("beacons.status", "MATCHED");

      if (error) {
        console.error(
          "[MatchedBeaconWatcher] failed to poll for MATCHED beacons:",
          error,
        );
        return;
      }

      let newlyMatched = false;
      for (const join of (data ?? []) as { beacon_id: string }[]) {
        if (!notifiedBeaconIds.has(join.beacon_id)) {
          notifiedBeaconIds.add(join.beacon_id);
          newlyMatched = true;
        }
      }

      if (newlyMatched) {
        saveSeenBeaconIds(currentUserId, notifiedBeaconIds);
        setMatchedDialogOpen(true);
      }
    }

    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        checkForMatchedBeacons();
      }
    }

    checkForMatchedBeacons();
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkForMatchedBeacons();
      }
    }, 10_000);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      clearInterval(intervalId);
    };
  }, [currentUserId]);

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
            (notifiedBeaconIdsRef.current as Set<string>).has(row.id)
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
            (notifiedBeaconIdsRef.current as Set<string>).add(row.id);
            saveSeenBeaconIds(
              currentUserId,
              notifiedBeaconIdsRef.current as Set<string>,
            );
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
