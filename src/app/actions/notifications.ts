"use server";

import { requireUser } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

export interface NotificationActionResult {
  error?: string;
}

/**
 * Marks a single notification read. Scoped to the caller's own
 * notifications via both the query filter and the `notifications_update_own`
 * RLS policy (recipient_id = auth.uid()) as defense in depth.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("markNotificationRead failed:", error);
    return {
      error: translate(locale, "errors.notificationUpdateFailed", {
        reason: error.message,
      }),
    };
  }

  return {};
}

/**
 * Marks every unread notification for the current user as read (e.g. when
 * they open the notification dropdown).
 */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("markAllNotificationsRead failed:", error);
    return {
      error: translate(locale, "errors.notificationsUpdateFailed", {
        reason: error.message,
      }),
    };
  }

  return {};
}

/**
 * Deletes a single notification. Scoped to the caller's own notifications
 * via both the query filter and the `notifications_delete_own` RLS policy
 * (recipient_id = auth.uid()) as defense in depth.
 */
export async function deleteNotification(
  notificationId: string,
): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) {
    console.error("deleteNotification failed:", error);
    return {
      error: translate(locale, "errors.notificationDeleteFailed", {
        reason: error.message,
      }),
    };
  }

  return {};
}

/**
 * Deletes every notification for the current user ("Clear all").
 */
export async function deleteAllNotifications(): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", user.id);

  if (error) {
    console.error("deleteAllNotifications failed:", error);
    return {
      error: translate(locale, "errors.notificationsDeleteFailed", {
        reason: error.message,
      }),
    };
  }

  return {};
}
