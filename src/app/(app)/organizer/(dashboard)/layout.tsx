import { Box } from "@mui/material";
import { requireOrganizerProfile } from "@/lib/session";
import { OrganizerSubNav } from "@/components/organizer/OrganizerSubNav";

// Guards every organiser-only page in one place: /organizer,
// /organizer/history, /organizer/settings. /organizer/apply deliberately
// sits outside this route group (see its own page.tsx) since it onboards
// someone who isn't an organiser yet.
export default async function OrganizerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrganizerProfile("/organizer");

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <OrganizerSubNav />
      <Box
        sx={{ bgcolor: "background.default" }}
        className="flex flex-1 flex-col items-center px-4 py-6 sm:px-8 sm:py-8"
      >
        {children}
      </Box>
    </div>
  );
}
