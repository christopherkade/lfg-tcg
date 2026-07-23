"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchedDialog } from "@/components/MatchedDialog";

interface MatchedPodWatcherProps {
  currentUserId: string;
}

/**
 * Pod ids the user has already been shown the MatchedDialog for,
 * persisted per-user in localStorage (mirroring LfgDialog's stored-search
 * pattern) so a page reload doesn't re-surface the dialog for a pod
 * matched long ago — the in-memory `notifiedPodIdsRef` alone only
 * guards against re-showing it within the same mount.
 */
function storageKey(userId: string) {
  return `lfg-tcg:seen-matched-pods:${userId}`;
}

function loadSeenPodIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSeenPodIds(userId: string, podIds: Iterable<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.from(podIds)),
    );
  } catch {
    // Ignore quota/serialization errors — persistence is a convenience,
    // not a requirement (worst case, the dialog re-surfaces once).
  }
}

/**
 * Watches for the current user's own accepted pod transitioning to
 * MATCHED, surfacing a blocking `MatchedDialog` (see that component for why
 * this is a dialog rather than a dismissable toast — it's the only cue an
 * accepted member gets before the card vanishes from every match-feed
 * query). Deliberately separate from `NotificationBell`: a MATCHED
 * transition isn't one of the persisted notification types (join request /
 * accepted / rejected / member left / pod updated) — it already has its
 * own dedicated blocking UX and isn't part of the notification history.
 *
 * This component previously also handled join-request/accepted toasts
 * (as `JoinRequestNotifier`); that responsibility has moved to
 * `NotificationBell`, which is driven off the persisted `notifications`
 * table instead of listening to `pods`/`pod_joins` directly — avoids
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
export function MatchedPodWatcher({ currentUserId }: MatchedPodWatcherProps) {
  const [matchedDialogOpen, setMatchedDialogOpen] = useState(false);
  // Guards against re-showing the dialog for a pod already surfaced —
  // seeded from localStorage (see storageKey above) so this also holds
  // across page reloads, not just within the current mount.
  const notifiedPodIdsRef = useRef<Set<string> | null>(null);
  if (notifiedPodIdsRef.current === null) {
    notifiedPodIdsRef.current = new Set(loadSeenPodIds(currentUserId));
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
    const notifiedPodIds = notifiedPodIdsRef.current as Set<string>;

    async function checkForMatchedPods() {
      const { data, error } = await supabase
        .from("pod_joins")
        .select("pod_id, pods!inner(status)")
        .eq("user_id", currentUserId)
        .eq("status", "ACCEPTED")
        .eq("pods.status", "MATCHED");

      if (error) {
        console.error(
          "[MatchedPodWatcher] failed to poll for MATCHED pods:",
          error,
        );
        return;
      }

      let newlyMatched = false;
      for (const join of (data ?? []) as { pod_id: string }[]) {
        if (!notifiedPodIds.has(join.pod_id)) {
          notifiedPodIds.add(join.pod_id);
          newlyMatched = true;
        }
      }

      if (newlyMatched) {
        saveSeenPodIds(currentUserId, notifiedPodIds);
        setMatchedDialogOpen(true);
      }
    }

    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        checkForMatchedPods();
      }
    }

    checkForMatchedPods();
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkForMatchedPods();
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
      .channel(`matched-pod-watcher-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pods" },
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
            (notifiedPodIdsRef.current as Set<string>).has(row.id)
          ) {
            return;
          }

          const { data: ownJoin, error: ownJoinError } = await supabase
            .from("pod_joins")
            .select("id")
            .eq("pod_id", row.id)
            .eq("user_id", currentUserId)
            .eq("status", "ACCEPTED")
            .maybeSingle();

          if (ownJoinError) {
            console.error(
              "[MatchedPodWatcher] failed to check own join for MATCHED pod:",
              ownJoinError,
            );
          }

          if (ownJoin) {
            (notifiedPodIdsRef.current as Set<string>).add(row.id);
            saveSeenPodIds(
              currentUserId,
              notifiedPodIdsRef.current as Set<string>,
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
