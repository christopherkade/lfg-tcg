import { requireOrganizerProfile } from "@/lib/session";
import { OrganizerStoreSettingsForm } from "@/components/organizer/OrganizerStoreSettingsForm";

export default async function OrganizerSettingsPage() {
  const { organizer } = await requireOrganizerProfile("/organizer/settings");

  return <OrganizerStoreSettingsForm organizer={organizer} />;
}
