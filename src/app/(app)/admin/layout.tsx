import { requireAdminProfile } from "@/lib/session";

// Guards every admin-only page in one place, same convention as
// organizer/(dashboard)/layout.tsx's requireOrganizerProfile() gate.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminProfile("/admin/applications");

  return <div className="flex flex-1 flex-col">{children}</div>;
}
