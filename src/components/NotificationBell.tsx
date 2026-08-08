"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
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
  CheckCircle,
  Clock,
  PencilLine,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  describeNotification,
  getNotificationHref,
  useNotificationCenter,
} from "@/components/NotificationCenterProvider";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { NotificationType, NotificationWithRelations } from "@/types/database";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  JOIN_REQUEST: UserPlus,
  JOIN_ACCEPTED: UserCheck,
  JOIN_REJECTED: UserX,
  MEMBER_LEFT: UserMinus,
  REMOVED_FROM_POD: UserX,
  POD_UPDATED: PencilLine,
  POD_UPDATED_PENDING: PencilLine,
  POD_DESTROYED: Trash2,
  POD_EXPIRED_INACTIVITY: Clock,
  ORGANIZER_APPLICATION_APPROVED: CheckCircle,
  ORGANIZER_APPLICATION_REJECTED: XCircle,
  ORGANIZER_APPLICATION_SUBMITTED: Send,
};

/**
 * Header notification bell — purely presentational. All fetch/poll/
 * realtime/toast state and logic lives in NotificationCenterProvider
 * (mounted once in `(app)/layout.tsx`); this just renders the bell button
 * and dropdown against that shared state. `TabBar` mounts two of these at
 * once (mobile top header + desktop navbar, toggled via CSS `sm:` classes),
 * which is exactly why the state was pulled out of this component in the
 * first place — see NotificationCenterProvider's own doc comment.
 */
export function NotificationBell() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateFnsLocale = locale === "fr" ? fr : undefined;
  const { notifications, unreadCount, markAllRead, deleteOne, deleteAll } =
    useNotificationCenter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    markAllRead();
  };

  const handleClose = () => setAnchorEl(null);

  const handleItemClick = (notification: NotificationWithRelations) => {
    handleClose();
    router.push(getNotificationHref(notification));
  };

  const handleDelete = (
    event: React.MouseEvent<HTMLElement>,
    notification: NotificationWithRelations,
  ) => {
    event.stopPropagation();
    deleteOne(notification);
  };

  const handleClearAll = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    deleteAll();
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-label={t("notificationBell.bellAria")}
        sx={{ color: "text.primary" }}
      >
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
            sx: (theme) => ({
              width: 340,
              maxWidth: "calc(100vw - 2rem)",
              // Fixed (not max) height: MUI's Popover repositions itself on
              // every re-render based on the Paper's *actual* rendered
              // height (see Popover.js's unconditional positioning effect).
              // With only a maxHeight, deleting notifications shrank the
              // Paper, which could cross the viewport-bottom clamp threshold
              // and jump the whole menu — including this header — up/down.
              // Pinning the height and scrolling the notification list
              // internally (below) keeps the Paper's footprint constant
              // regardless of how many notifications remain.
              height: 420,
              maxHeight: "calc(100vh - 4rem)",
              display: "flex",
              flexDirection: "column",
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              mt: 1,
            }),
          },
          // MenuList adds its own 8px top/bottom padding by default, which
          // sits *outside* the empty/loading states' own centering box below
          // — since that padding only follows the last child, it made the
          // placeholder text look off-center (extra space under it, not over
          // it). Zeroing it here means the header/divider/items' own
          // paddings are the only spacing left in play.
          //
          // Also stretched to fill the now fixed-height Paper (flex column)
          // so the scrollable content wrapper below can claim the remaining
          // space via flex: 1, instead of the list only growing to fit its
          // content.
          list: {
            sx: { py: 0, height: "100%", display: "flex", flexDirection: "column" },
          },
        }}
      >
        <div
          className="flex items-center justify-between px-2 py-1.5"
          style={{ flexShrink: 0 }}
        >
          <Typography
            sx={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            {t("notificationBell.title")}
          </Typography>
          <ButtonBase
            onClick={handleClearAll}
            disabled={!notifications || notifications.length === 0}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "text.primary",
              // Kept mounted (rather than conditionally rendered) so the
              // header row's height — and therefore the vertically-centered
              // "Notifications" label's position — never changes when the
              // last notification is deleted/cleared. Hiding via visibility
              // still reserves the layout space, unlike unmounting.
              visibility:
                notifications && notifications.length > 0
                  ? "visible"
                  : "hidden",
              "&:hover": { color: "text.secondary" },
            }}
          >
            {t("notificationBell.clearAll")}
          </ButtonBase>
        </div>
        <Divider sx={{ borderColor: "divider", flexShrink: 0 }} />

        {/* Fixed-height, independently-scrolling region — see the Paper's
            `height` comment above for why this can't just grow/shrink with
            the notification count. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {notifications === null && (
            <div className="flex h-full items-center justify-center px-4 py-6">
              <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                {t("notificationBell.loading")}
              </Typography>
            </div>
          )}

          {notifications !== null && notifications.length === 0 && (
            <div className="flex h-full items-center justify-center px-4 py-6">
              <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                {t("notificationBell.empty")}
              </Typography>
            </div>
          )}

          {notifications?.map((notification) => {
            const Icon = TYPE_ICON[notification.type];
            return (
              <MenuItem
                key={notification.id}
                onClick={() => handleItemClick(notification)}
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
                  <Typography sx={{ fontSize: "0.8125rem", color: "text.primary" }}>
                    {describeNotification(notification, t)}
                  </Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
                    {formatDistanceToNowStrict(
                      new Date(notification.created_at),
                      { addSuffix: true, locale: dateFnsLocale },
                    )}
                  </Typography>
                </div>
                <IconButton
                  component="span"
                  size="small"
                  aria-label={t("notificationBell.deleteAria")}
                  onClick={(event) => handleDelete(event, notification)}
                  sx={{
                    mt: -0.5,
                    color: "text.primary",
                    "&:hover": { color: "text.secondary" },
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </MenuItem>
            );
          })}
        </div>
      </Menu>
    </>
  );
}
