"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MatchedDialog } from "@/components/MatchedDialog";
import { usePodRealtime } from "@/components/PodRealtimeProvider";

interface MatchedPodWatcherProps {
  currentUserId: string;
}

/**
 * Watches for the current user's own accepted pod transitioning to
 * MATCHED, surfacing a blocking `MatchedDialog` (see that component for why
 * this is a dialog rather than a dismissable snackbar — it's the only cue an
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
 * "Already shown" state is tracked server-side via
 * `pod_joins.matched_notified_at` (see supabase/sql/matched_notification_seen.sql),
 * set through the `mark_matched_notification_seen` RPC rather than a
 * client-facing UPDATE policy. This used to be tracked in localStorage,
 * which is per-device — on a new device the set started empty, and the
 * on-mount poll below has no time bound (it just checks "am I ACCEPTED on a
 * pod that is currently MATCHED"), so any pod matched long ago looked brand
 * new and re-triggered the dialog on first login on a new device.
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
  const { notifyPodsChanged } = usePodRealtime();
  // In-flight guard only: prevents the poll and the realtime handler from
  // both firing the RPC + dialog for the same pod_joins row before the
  // server-side matched_notified_at write lands. The server column (not
  // this ref) is the source of truth across mounts/devices.
  const notifyingPodJoinIdsRef = useRef<Set<string>>(new Set());

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
    const notifying = notifyingPodJoinIdsRef.current;

    async function checkForMatchedPods() {
      const { data, error } = await supabase
        .from("pod_joins")
        .select("id, pods!inner(status)")
        .eq("user_id", currentUserId)
        .eq("status", "ACCEPTED")
        .eq("pods.status", "MATCHED")
        .is("matched_notified_at", null);

      if (error) {
        console.error(
          "[MatchedPodWatcher] failed to poll for MATCHED pods:",
          error,
        );
        return;
      }

      const newlyMatched = ((data ?? []) as { id: string }[]).filter(
        (join) => !notifying.has(join.id),
      );

      if (newlyMatched.length === 0) return;

      for (const join of newlyMatched) {
        notifying.add(join.id);
      }

      await Promise.all(
        newlyMatched.map((join) =>
          supabase.rpc("mark_matched_notification_seen", {
            p_pod_join_id: join.id,
          }),
        ),
      );

      setMatchedDialogOpen(true);
      // The pod(s) behind this dialog just left every match-feed query
      // (status is no longer ACTIVE) — force MatchFeed/OwnPodPanel/LfgButton
      // to refetch now rather than waiting on their own, separately
      // unreliable postgres_changes delivery to notice the same UPDATE.
      notifyPodsChanged();
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
  }, [currentUserId, notifyPodsChanged]);

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
          if (row.status !== "MATCHED" || row.user_id === currentUserId) {
            return;
          }

          const { data: ownJoin, error: ownJoinError } = await supabase
            .from("pod_joins")
            .select("id, matched_notified_at")
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

          if (
            ownJoin &&
            !ownJoin.matched_notified_at &&
            !notifyingPodJoinIdsRef.current.has(ownJoin.id)
          ) {
            notifyingPodJoinIdsRef.current.add(ownJoin.id);
            await supabase.rpc("mark_matched_notification_seen", {
              p_pod_join_id: ownJoin.id,
            });
            setMatchedDialogOpen(true);
            // See the poll effect above for why this is needed in addition
            // to PodRealtimeProvider's own (separate) postgres_changes
            // subscription.
            notifyPodsChanged();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, notifyPodsChanged]);

  return (
    <MatchedDialog
      open={matchedDialogOpen}
      onClose={() => setMatchedDialogOpen(false)}
    />
  );
}
