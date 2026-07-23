"use server";

import { requireUser } from "@/lib/session";

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

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("markNotificationRead failed:", error);
    return { error: `Could not update notification: ${error.message}` };
  }

  return {};
}

/**
 * Marks every unread notification for the current user as read (e.g. when
 * they open the notification dropdown).
 */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("markAllNotificationsRead failed:", error);
    return { error: `Could not update notifications: ${error.message}` };
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

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) {
    console.error("deleteNotification failed:", error);
    return { error: `Could not delete notification: ${error.message}` };
  }

  return {};
}

/**
 * Deletes every notification for the current user ("Clear all").
 */
export async function deleteAllNotifications(): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", user.id);

  if (error) {
    console.error("deleteAllNotifications failed:", error);
    return { error: `Could not delete notifications: ${error.message}` };
  }

  return {};
}
