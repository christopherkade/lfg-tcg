"use server";

import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

export interface AdminActionResult {
  error?: string;
}

/**
 * Both actions delegate the actual mutation to a SECURITY DEFINER Postgres
 * function (supabase/sql/organizer_application_review.sql) — same reasoning
 * as every other privileged write in this schema (see notify_on_pod_join_*
 * in schema.sql): organizer_applications/organizers/notifications have no
 * authenticated update/insert policy that would let this run as a plain
 * client-side update, and the admin check is enforced again inside the SQL
 * function itself, not just here.
 */
export async function approveOrganizerApplication(
  applicationId: string,
): Promise<AdminActionResult> {
  const { supabase } = await requireAdminProfile();
  const locale = await getServerLocale();

  const { error } = await supabase.rpc("approve_organizer_application", {
    p_application_id: applicationId,
  });

  if (error) {
    console.error("approveOrganizerApplication failed:", error);
    return {
      error: translate(locale, "errors.applicationReviewFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/admin/applications");
  return {};
}

export async function rejectOrganizerApplication(
  applicationId: string,
): Promise<AdminActionResult> {
  const { supabase } = await requireAdminProfile();
  const locale = await getServerLocale();

  const { error } = await supabase.rpc("reject_organizer_application", {
    p_application_id: applicationId,
  });

  if (error) {
    console.error("rejectOrganizerApplication failed:", error);
    return {
      error: translate(locale, "errors.applicationReviewFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/admin/applications");
  return {};
}
