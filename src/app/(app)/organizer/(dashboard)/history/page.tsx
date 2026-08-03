import { requireOrganizerProfile } from "@/lib/session";
import { OrganizerTableHistoryList } from "@/components/organizer/OrganizerTableHistoryList";
import type { PodHistoryEntry } from "@/types/database";

export default async function OrganizerHistoryPage() {
  const { supabase, organizer } = await requireOrganizerProfile(
    "/organizer/history",
  );

  // Not awaited here — OrganizerTableHistoryList suspends on this itself.
  // host_id = organizer.id and recurring_table_id not null scopes this to
  // organiser-run table history only, excluding any of the organiser's own
  // ad hoc "Past Pods" entries (those have recurring_table_id = null).
  const entriesPromise = Promise.resolve(
    supabase
      .from("pod_history")
      .select("*")
      .eq("host_id", organizer.id)
      .not("recurring_table_id", "is", null)
      .order("matched_at", { ascending: false })
      .limit(50)
      .then(({ data }) => (data ?? []) as PodHistoryEntry[]),
  );

  return <OrganizerTableHistoryList entriesPromise={entriesPromise} />;
}
