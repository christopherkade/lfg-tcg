import { requireOrganizerProfile } from "@/lib/session";
import { OrganizerDashboard } from "@/components/organizer/OrganizerDashboard";
import type { RecurringTable } from "@/types/database";

export default async function OrganizerTablesPage() {
  const { supabase, organizer } = await requireOrganizerProfile("/organizer");

  // Not awaited here — OrganizerRecurringTableList suspends on this itself,
  // so the dashboard's title/new-table button render instantly instead of
  // blocking on this Supabase round-trip. Wrapped in Promise.resolve() —
  // Supabase's query builders are thenable but not real Promise instances.
  const recurringTablesPromise = Promise.resolve(
    supabase
      .from("recurring_tables")
      .select("*")
      .eq("organizer_id", organizer.id)
      .order("day_of_week", { ascending: true })
      .then(({ data }) => (data ?? []) as RecurringTable[]),
  );

  return (
    <OrganizerDashboard
      organizerId={organizer.id}
      recurringTablesPromise={recurringTablesPromise}
    />
  );
}
