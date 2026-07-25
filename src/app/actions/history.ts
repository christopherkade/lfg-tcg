"use server";

import { requireUser } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

export interface HistoryActionResult {
  error?: string;
}

/**
 * Removes a pod_history entry from the caller's own "Past Pods" list.
 * A pod_history row is shared by the host and every accepted member, so
 * this doesn't delete the row — it calls the `hide_pod_history_entry`
 * SECURITY DEFINER function (supabase/sql/pod_history.sql), which appends
 * the caller's id onto that row's `hidden_by` array. The RLS SELECT policy
 * excludes rows containing the caller's own id, so the entry disappears
 * from their view only; the host's and other members' visibility of the
 * same pod is untouched.
 */
export async function deletePodHistoryEntry(
  entryId: string,
): Promise<HistoryActionResult> {
  const { supabase } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase.rpc("hide_pod_history_entry", {
    p_entry_id: entryId,
  });

  if (error) {
    console.error("deletePodHistoryEntry failed:", error);
    return {
      error: translate(locale, "errors.historyDeleteFailed", {
        reason: error.message,
      }),
    };
  }

  return {};
}
