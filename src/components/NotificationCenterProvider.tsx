"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { ButtonBase, IconButton } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { playSound } from "@/lib/soundEffect";
import type { TranslationKey } from "@/lib/i18n";
import type {
  NotificationType,
  NotificationWithRelations,
} from "@/types/database";

// Explicit FK constraint name needed because `notifications` has two FKs to
// `profiles` (recipient_id, actor_id) — without it, PostgREST can't tell
// which one to embed as `actor`.
const NOTIFICATION_SELECT =
  "*, actor:profiles!notifications_actor_id_fkey(id, username, avatar_url), pod:pods(id, game_key, format_key)";

const RECENT_LIMIT = 20;

interface Toast {
  id: string;
  message: string;
}

export function describeNotification(
  notification: NotificationWithRelations,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const actorName = notification.actor?.username ?? t("notification.someone");

  switch (notification.type as NotificationType) {
    case "JOIN_REQUEST":
      return t("notification.joinRequest", { actor: actorName });
    case "JOIN_ACCEPTED":
      return t("notification.joinAccepted", { actor: actorName });
    case "JOIN_REJECTED":
      return t("notification.joinRejected", { actor: actorName });
    case "MEMBER_LEFT":
      return t("notification.memberLeft", { actor: actorName });
    case "REMOVED_FROM_POD":
      return t("notification.removedFromPod", { actor: actorName });
    case "POD_UPDATED":
      return t("notification.podUpdated", { actor: actorName });
    case "POD_UPDATED_PENDING":
      return t("notification.podUpdatedPending", { actor: actorName });
    case "POD_DESTROYED":
      return t("notification.podDestroyed", { actor: actorName });
    case "POD_EXPIRED_INACTIVITY":
      return t("notification.podExpiredInactivity");
  }
}

interface NotificationCenterContextValue {
  notifications: NotificationWithRelations[] | null;
  unreadCount: number;
  markAllRead: () => void;
  deleteOne: (notification: NotificationWithRelations) => void;
  deleteAll: () => void;
}

const NotificationCenterContext =
  createContext<NotificationCenterContextValue | null>(null);

/**
 * Owns the notifications fetch/poll/realtime-subscribe lifecycle and the
 * toast UI exactly once per tab. `TabBar` renders two `NotificationBell`
 * buttons at once (mobile top header + desktop navbar, toggled purely via
 * CSS `sm:` classes — both stay mounted in the DOM regardless of viewport),
 * so before this provider existed each button independently fetched,
 * polled, and opened its own realtime channel: double the query/channel
 * count for no benefit, and — since both channels received the exact same
 * INSERT event — a double chime/OS notification/toast per incoming
 * notification. Mounted once in `(app)/layout.tsx`, mirroring
 * PodRealtimeProvider's equivalent consolidation for pods/pod_joins.
 */
export function NotificationCenterProvider({
  currentUserId,
  children,
}: {
  currentUserId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<
    NotificationWithRelations[] | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  // Played via Web Audio API (not HTMLAudioElement), same as LfgButton's
  // click sound, so iOS Safari doesn't show its "now playing" pill.
  const playChime = useCallback(() => {
    playSound("/sounds/notification.wav", { volume: 0.5 });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleNewNotification = useCallback(
    (notification: NotificationWithRelations) => {
      setNotifications((current) =>
        [notification, ...(current ?? [])].slice(0, RECENT_LIMIT),
      );
      setUnreadCount((count) => count + 1);
      playChime();

      const message = describeNotification(notification, t);
      setToast({ id: notification.id, message });

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const osNotification = new Notification(t("notificationBell.osTitle"), {
          body: message,
        });
        osNotification.onclick = () => {
          window.focus();
          router.push("/pods");
          osNotification.close();
        };
      }
    },
    [router, t, playChime],
  );

  // Routed through a ref rather than listed as an effect dependency — see
  // repo memory on realtime channel churn. `handleNewNotification` gets a
  // new identity whenever `router` does; depending on it directly would
  // tear down and resubscribe the channel below on every such change,
  // opening gaps where inserts get silently and permanently missed.
  const handleNewNotificationRef = useRef(handleNewNotification);
  useEffect(() => {
    handleNewNotificationRef.current = handleNewNotification;
  }, [handleNewNotification]);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select(NOTIFICATION_SELECT)
        .eq("recipient_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", currentUserId)
        .is("read_at", null),
    ]);
    setNotifications((data as NotificationWithRelations[] | null) ?? []);
    setUnreadCount(count ?? 0);
  }, [currentUserId]);

  // Same ref-indirection reasoning as handleNewNotificationRef above.
  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project even for long-proven
  // subscriptions (channel stays SUBSCRIBED, but specific events never
  // arrive) — independent of the notifications feature itself. Resync
  // whenever the tab regains focus/visibility (e.g. switching back from
  // another tab/app, or the OS waking the browser from sleep), so a missed
  // event self-heals without the user needing to manually reload. On top of
  // that, also poll on an interval while the tab stays visible and focused
  // the whole time (mirroring MatchedPodWatcher/OwnPodPanel's fallback, for
  // the same reason: a focus/visibility listener alone never fires if the
  // user never looks away). 25s (not 10s) since this is purely a safety net
  // for realtime's own occasional delivery misses, not the primary update
  // path. No CSS-visibility gating needed anymore — this now runs exactly
  // once per tab regardless of which NotificationBell button is visible.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchNotificationsRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotificationsRef.current();
      }
    }, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // No server-side `filter` param here — deliberately mirrors every other
    // realtime subscription in this codebase (MatchFeed, OwnPodPanel,
    // LfgButton, MatchedPodWatcher). Supabase Realtime re-checks the
    // table's SELECT RLS policy per subscriber on EVERY postgres_changes
    // event regardless of whether a `filter` is set, and
    // `notifications_select_own` already restricts rows to `recipient_id =
    // auth.uid()` — so this client only ever receives its own
    // notifications either way, `filter` was redundant. It was also the
    // one thing observed to actually break live delivery in practice (rows
    // were inserted and visible on refetch, but the INSERT event never
    // reached the open tab) — don't reintroduce a `filter` on this channel.
    // No per-instance suffix needed on the channel name either (unlike the
    // old per-NotificationBell channel) — this provider mounts exactly
    // once per tab.
    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        async (payload) => {
          const { data, error } = await supabase
            .from("notifications")
            .select(NOTIFICATION_SELECT)
            .eq("id", payload.new.id)
            .maybeSingle();
          if (error) {
            console.error(
              "[NotificationCenterProvider] failed to refetch inserted notification:",
              error,
            );
          }
          if (data) {
            handleNewNotificationRef.current(data as NotificationWithRelations);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as { id: string; read_at: string | null };
          setNotifications(
            (current) =>
              current?.map((notification) =>
                notification.id === row.id
                  ? { ...notification, read_at: row.read_at }
                  : notification,
              ) ?? current,
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchNotificationsRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const markAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    const readAt = new Date().toISOString();
    setUnreadCount(0);
    setNotifications(
      (current) =>
        current?.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? readAt,
        })) ?? current,
    );
    markAllNotificationsRead();
  }, [unreadCount]);

  const deleteOne = useCallback((notification: NotificationWithRelations) => {
    setNotifications(
      (current) =>
        current?.filter((item) => item.id !== notification.id) ?? current,
    );
    if (!notification.read_at) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    deleteNotification(notification.id);
  }, []);

  const deleteAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    deleteAllNotifications();
  }, []);

  const value = useMemo<NotificationCenterContextValue>(
    () => ({ notifications, unreadCount, markAllRead, deleteOne, deleteAll }),
    [notifications, unreadCount, markAllRead, deleteOne, deleteAll],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm sm:top-auto sm:bottom-6 sm:right-6 sm:w-full">
          <ButtonBase
            onClick={() => {
              setToast(null);
              router.push("/pods");
            }}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              width: "100%",
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
              px: 2,
              py: 1.5,
              textAlign: "left",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.4)",
            })}
          >
            <Bell className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="flex-1 text-sm" style={{ color: "inherit" }}>
              {toast.message}
            </span>
            <IconButton
              component="span"
              size="small"
              aria-label={t("notificationBell.dismissToastAria")}
              onClick={(event) => {
                event.stopPropagation();
                setToast(null);
              }}
              sx={{ color: "text.primary", "&:hover": { color: "text.secondary" } }}
            >
              <X className="h-4 w-4" />
            </IconButton>
          </ButtonBase>
        </div>
      )}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error(
      "useNotificationCenter must be used within a NotificationCenterProvider",
    );
  }
  return context;
}
