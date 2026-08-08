import { Box, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { requireProfile, getOrganizer } from "@/lib/session";
import { OrganizerApplyForm } from "@/components/organizer/OrganizerApplyForm";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

// Deliberately unlisted — not linked from TabBar or anywhere else in the
// app. This is the one onboarding exception that uses requireProfile()
// instead of requireOrganizerProfile(): the whole point is letting someone
// who isn't an organiser yet apply.
export default async function OrganizerApplyPage() {
  const { supabase, user } = await requireProfile("/organizer/apply");
  const organizer = await getOrganizer(supabase, user.id);

  if (organizer) {
    redirect("/organizer");
  }

  const { data: pendingApplication } = await supabase
    .from("organizer_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  const locale = await getServerLocale();

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      {pendingApplication ? (
        <div className="flex w-full max-w-md flex-col gap-2 text-center">
          <Typography
            component="h1"
            sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
          >
            {translate(locale, "organizer.apply.pendingTitle")}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            {translate(locale, "organizer.apply.pendingSubtitle")}
          </Typography>
        </div>
      ) : (
        <OrganizerApplyForm />
      )}
    </Box>
  );
}
