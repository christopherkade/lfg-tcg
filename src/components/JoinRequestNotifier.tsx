"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MatchedDialog } from "@/components/MatchedDialog";

interface JoinRequestNotifierProps {
  currentUserId: string;
}

interface Toast {
  id: string;
  message: string;
}

/**
 * Watches for (a) new join requests on the current user's own active beacon
 * (host side), (b) the current user's own join request being accepted
 * (joiner side), and (c) a beacon the current user joined being marked
 * MATCHED, surfacing (a) and (b) as a native OS notification + in-app
 * snackbar, and (c) as a blocking dialog (see MatchedDialog for why) —
 * native notifications only fire while the PWA/tab's JS is actually
 * running, there is no service-worker push involved. Clicking a
 * notification/snackbar takes the user to /beacons.
 */
export function JoinRequestNotifier({
  currentUserId,
}: JoinRequestNotifierProps) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [matchedDialogOpen, setMatchedDialogOpen] = useState(false);
  // Tracked via a ref (not state) so the single long-lived beacon_joins
  // listener below always reads the latest value without needing to
  // tear down and recreate its channel subscription.
  const ownBeaconIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notify = useCallback(
    (id: string, message: string) => {
      setToast({ id, message });

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("ManaMatch", { body: message });
        notification.onclick = () => {
          window.focus();
          router.push("/beacons");
          notification.close();
        };
      }
    },
    [router],
  );

  // Routed through a ref rather than listed as an effect dependency:
  // `notify` gets a new identity whenever `router` does, and depending on
  // it directly would tear down and resubscribe the channel below on
  // every such change, opening gaps where realtime events (a join
  // request, an acceptance) get silently missed. The ref keeps the
  // subscription stable for the component's full mounted lifetime while
  // still always calling the latest `notify`.
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  // Single long-lived subscription for the lifetime of this component
  // (mounted once in the (app) layout). Deliberately mirrors MatchFeed's
  // proven approach of subscribing with no server-side `filter` and doing
  // the matching client-side, rather than relying on dynamically
  // recreated per-id filtered channels (which are more fragile and
  // harder to reason about with realtime's eventual-consistency timing).
  useEffect(() => {
    const supabase = createClient();

    async function syncOwnBeaconId() {
      const { data } = await supabase
        .from("beacons")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      ownBeaconIdRef.current = data?.id ?? null;
    }

    const channel = supabase
      .channel(`join-request-notifier-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            user_id?: string;
          } | null;
          if (row?.user_id === currentUserId) {
            syncOwnBeaconId();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "beacons" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            user_id: string;
          };
          console.debug("[JoinRequestNotifier] beacons UPDATE received:", row);
          // The host already knows — they're the one who marked it
          // matched. This dialog is for the people who joined them.
          if (row.status !== "MATCHED" || row.user_id === currentUserId) {
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
              "[JoinRequestNotifier] failed to check own join for MATCHED beacon:",
              ownJoinError,
            );
          }

          console.debug(
            "[JoinRequestNotifier] MATCHED beacon, own accepted join row:",
            ownJoin,
          );

          if (ownJoin) {
            setMatchedDialogOpen(true);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "beacon_joins" },
        async (payload) => {
          const beaconId = payload.new.beacon_id as string;
          if (!ownBeaconIdRef.current || beaconId !== ownBeaconIdRef.current) {
            return;
          }

          const joinerId = payload.new.user_id as string;
          const { data: joinerProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", joinerId)
            .maybeSingle();

          notifyRef.current(
            `join-request-${payload.new.id}`,
            `${joinerProfile?.username ?? "Someone"} wants to join your beacon`,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "beacon_joins" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            beacon_id: string;
            status: string;
          };
          if (row.user_id !== currentUserId || row.status !== "ACCEPTED") {
            return;
          }

          const { data: hostBeacon } = await supabase
            .from("beacons")
            .select("profiles(username)")
            .eq("id", row.beacon_id)
            .maybeSingle();
          const hostProfile = Array.isArray(hostBeacon?.profiles)
            ? hostBeacon.profiles[0]
            : hostBeacon?.profiles;

          notifyRef.current(
            `join-accepted-${row.id}`,
            `You've been accepted into ${hostProfile?.username ?? "the"} beacon!`,
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncOwnBeaconId();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <>
      {toast && (
        <div className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm sm:top-auto sm:bottom-6 sm:right-6 sm:w-full">
          <button
            type="button"
            onClick={() => {
              setToast(null);
              router.push("/beacons");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-lg shadow-black/40"
          >
            <Bell className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="flex-1 text-sm text-zinc-100">
              {toast.message}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                setToast(null);
              }}
              className="shrink-0 rounded-full p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      <MatchedDialog
        open={matchedDialogOpen}
        onClose={() => setMatchedDialogOpen(false)}
      />
    </>
  );
}
