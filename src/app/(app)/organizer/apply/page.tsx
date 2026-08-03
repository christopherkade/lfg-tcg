import { Box } from "@mui/material";
import { redirect } from "next/navigation";
import { requireProfile, getOrganizer } from "@/lib/session";
import { OrganizerApplyForm } from "@/components/organizer/OrganizerApplyForm";

// Deliberately unlisted — not linked from TabBar or anywhere else in the
// app. This is the one onboarding exception that uses requireProfile()
// instead of requireOrganizerProfile(): the whole point is granting
// organiser status to someone who doesn't have it yet.
export default async function OrganizerApplyPage() {
  const { supabase, user } = await requireProfile("/organizer/apply");
  const organizer = await getOrganizer(supabase, user.id);

  if (organizer) {
    redirect("/organizer");
  }

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      <OrganizerApplyForm />
    </Box>
  );
}
