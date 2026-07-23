"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Badge,
  ButtonBase,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  Bell,
  PencilLine,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import type {
  NotificationType,
  NotificationWithRelations,
} from "@/types/database";

interface NotificationBellProps {
  currentUserId: string;
}

interface Toast {
  id: string;
  message: string;
}

// Explicit FK constraint name needed because `notifications` has two FKs to
// `profiles` (recipient_id, actor_id) — without it, PostgREST can't tell
// which one to embed as `actor`.
const NOTIFICATION_SELECT =
  "*, actor:profiles!notifications_actor_id_fkey(id, username, avatar_url), pod:pods(id, game_key, format_key)";

const RECENT_LIMIT = 20;

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  JOIN_REQUEST: UserPlus,
  JOIN_ACCEPTED: UserCheck,
  JOIN_REJECTED: UserX,
  MEMBER_LEFT: UserMinus,
  REMOVED_FROM_POD: UserX,
  POD_UPDATED: PencilLine,
};

function describeNotification(notification: NotificationWithRelations): string {
  const actorName = notification.actor?.username ?? "Someone";

  switch (notification.type) {
    case "JOIN_REQUEST":
      return `${actorName} wants to join your pod`;
    case "JOIN_ACCEPTED":
      return `You've been accepted into ${actorName}'s pod!`;
    case "JOIN_REJECTED":
      return `${actorName} declined your request to join their pod`;
    case "MEMBER_LEFT":
      return `${actorName} left your pod`;
    case "REMOVED_FROM_POD":
      return `${actorName} removed you from their pod`;
    case "POD_UPDATED":
      return `${actorName} updated the details of a pod you joined`;
  }
}

/**
 * Header notification bell — a persisted notification center backed by the
 * `notifications` table (see supabase/schema.sql: rows are created
 * exclusively by SECURITY DEFINER triggers on pod_joins/pods, never
 * inserted by the client). Fetches the most recent rows plus an unread
 * count, then subscribes to INSERT/UPDATE events on the table with no
 * server-side `filter` — Realtime re-checks the `notifications_select_own`
 * RLS policy (`recipient_id = auth.uid()`) per subscriber on every event
 * regardless of `filter`, so this client only ever receives its own
 * notifications either way; this is load-bearing for scalability (no
 * firehose of every user's activity) without needing a `filter` param,
 * which was observed to silently break live delivery in practice. New
 * inserts also surface as a toast + native OS notification, matching the
 * foreground-only alert UX this app already uses elsewhere (no service
 * worker / push — see SPECS.md Section 7).
 */
export function NotificationBell({ currentUserId }: NotificationBellProps) {
  const router = useRouter();
  // `TabBar` mounts two `NotificationBell` instances at once (one in the
  // mobile top header, one in the desktop navbar — only one is ever visible,
  // toggled purely via CSS `sm:` classes so both stay mounted in the DOM).
  // Without a per-instance suffix, both would open a realtime channel with
  // the exact same name (`notifications-${currentUserId}`); the second
  // `.channel()` call then returns the first instance's already-subscribed
  // channel, and calling `.on()` on it throws "cannot add postgres_changes
  // callbacks ... after subscribe()". `useId()` keeps each instance's
  // channel name unique regardless of how many share the same currentUserId.
  const instanceId = useId();
  const [notifications, setNotifications] = useState<
    NotificationWithRelations[] | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

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

      const message = describeNotification(notification);
      setToast({ id: notification.id, message });

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const osNotification = new Notification("PodMaker", {
          body: message,
        });
        osNotification.onclick = () => {
          window.focus();
          router.push("/pods");
          osNotification.close();
        };
      }
    },
    [router],
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
  // arrive) — independent of the notifications feature itself. Rather than
  // only ever refreshing on a full page reload, resync whenever the tab
  // regains focus/visibility (e.g. switching back from another tab/app, or
  // the OS waking the browser from sleep), so a missed event self-heals
  // without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchNotificationsRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
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
    const channel = supabase
      .channel(`notifications-${currentUserId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        async (payload) => {
          console.debug("[NotificationBell] INSERT event received:", payload);
          const { data, error } = await supabase
            .from("notifications")
            .select(NOTIFICATION_SELECT)
            .eq("id", payload.new.id)
            .maybeSingle();
          if (error) {
            console.error(
              "[NotificationBell] failed to refetch inserted notification:",
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
      .subscribe((status, err) => {
        console.debug("[NotificationBell] channel status:", status, err);
        if (status === "SUBSCRIBED") {
          fetchNotificationsRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, instanceId]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (unreadCount > 0) {
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
    }
  };

  const handleClose = () => setAnchorEl(null);

  const handleItemClick = () => {
    handleClose();
    router.push("/pods");
  };

  const handleDelete = (
    event: React.MouseEvent<HTMLElement>,
    notification: NotificationWithRelations,
  ) => {
    event.stopPropagation();
    setNotifications(
      (current) =>
        current?.filter((item) => item.id !== notification.id) ?? current,
    );
    if (!notification.read_at) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    deleteNotification(notification.id);
  };

  const handleClearAll = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setNotifications([]);
    setUnreadCount(0);
    deleteAllNotifications();
  };

  return (
    <>
      <IconButton onClick={handleOpen} sx={{ color: "#a1a1aa" }}>
        <Badge badgeContent={unreadCount} max={9} color="error">
          <Bell className="h-5 w-5" />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxWidth: "calc(100vw - 2rem)",
              maxHeight: 420,
              bgcolor: "#18181b",
              border: "1px solid #27272a",
              mt: 1,
            },
          },
          // MenuList adds its own 8px top/bottom padding by default, which
          // sits *outside* the empty/loading states' own centering box below
          // — since that padding only follows the last child, it made the
          // placeholder text look off-center (extra space under it, not over
          // it). Zeroing it here means the header/divider/items' own
          // paddings are the only spacing left in play.
          list: { sx: { py: 0 } },
        }}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <Typography
            sx={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#fafafa",
            }}
          >
            Notifications
          </Typography>
          {notifications !== null && notifications.length > 0 && (
            <ButtonBase
              onClick={handleClearAll}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#a1a1aa",
                "&:hover": { color: "#e4e4e7" },
              }}
            >
              Clear all
            </ButtonBase>
          )}
        </div>
        <Divider sx={{ borderColor: "#27272a" }} />

        {notifications === null && (
          <div className="flex min-h-40 items-center justify-center px-4 py-6">
            <Typography sx={{ fontSize: "0.875rem", color: "#71717a" }}>
              Loading…
            </Typography>
          </div>
        )}

        {notifications !== null && notifications.length === 0 && (
          <div className="flex min-h-40 items-center justify-center px-4 py-6">
            <Typography sx={{ fontSize: "0.875rem", color: "#71717a" }}>
              No notifications yet.
            </Typography>
          </div>
        )}

        {notifications?.map((notification) => {
          const Icon = TYPE_ICON[notification.type];
          return (
            <MenuItem
              key={notification.id}
              onClick={handleItemClick}
              sx={{
                alignItems: "flex-start",
                gap: 1.5,
                whiteSpace: "normal",
                py: 1.25,
                bgcolor: notification.read_at
                  ? "transparent"
                  : "rgba(245, 158, 11, 0.08)",
              }}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex flex-1 flex-col gap-0.5">
                <Typography sx={{ fontSize: "0.8125rem", color: "#e4e4e7" }}>
                  {describeNotification(notification)}
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#71717a" }}>
                  {formatDistanceToNowStrict(
                    new Date(notification.created_at),
                    { addSuffix: true },
                  )}
                </Typography>
              </div>
              <IconButton
                component="span"
                size="small"
                aria-label="Delete notification"
                onClick={(event) => handleDelete(event, notification)}
                sx={{
                  mt: -0.5,
                  color: "#71717a",
                  "&:hover": { color: "#d4d4d8" },
                }}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </MenuItem>
          );
        })}
      </Menu>

      {toast && (
        <div className="fixed right-4 top-4 z-40 w-[calc(100%-2rem)] max-w-sm sm:top-auto sm:bottom-6 sm:right-6 sm:w-full">
          <ButtonBase
            onClick={() => {
              setToast(null);
              router.push("/pods");
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              width: "100%",
              borderRadius: 4,
              border: "1px solid #27272a",
              bgcolor: "#18181b",
              px: 2,
              py: 1.5,
              textAlign: "left",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.4)",
            }}
          >
            <Bell className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="flex-1 text-sm text-zinc-100">
              {toast.message}
            </span>
            <IconButton
              component="span"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setToast(null);
              }}
              sx={{ color: "#71717a", "&:hover": { color: "#d4d4d8" } }}
            >
              <X className="h-4 w-4" />
            </IconButton>
          </ButtonBase>
        </div>
      )}
    </>
  );
}
