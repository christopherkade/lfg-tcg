import { Box, Typography } from "@mui/material";
import { requireAdminProfile } from "@/lib/session";
import { AdminApplicationList } from "@/components/admin/AdminApplicationList";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import type { OrganizerApplicationWithApplicant } from "@/types/database";

export default async function AdminApplicationsPage() {
  const { supabase } = await requireAdminProfile("/admin/applications");
  const locale = await getServerLocale();

  // Not awaited here — AdminApplicationList suspends on this itself, same
  // convention as OrganizerRecurringTableList/recurringTablesPromise.
  //
  // Explicit FK constraint name needed because `organizer_applications` has
  // two FKs to `profiles` (user_id, reviewed_by) — without it, PostgREST
  // can't tell which one to embed as `profiles` and returns an ambiguity
  // error instead of data (same pitfall NOTIFICATION_SELECT in
  // NotificationCenterProvider.tsx already works around).
  const applicationsPromise = Promise.resolve(
    supabase
      .from("organizer_applications")
      .select(
        "*, profiles!organizer_applications_user_id_fkey(id, username, discord_handle, avatar_url)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch organizer applications:", error);
        }
        return (data ?? []) as OrganizerApplicationWithApplicant[];
      }),
  );

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center px-4 py-6 sm:px-8 sm:py-8"
    >
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Typography
            component="h1"
            sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
          >
            {translate(locale, "admin.applications.title")}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            {translate(locale, "admin.applications.subtitle")}
          </Typography>
        </div>
        <AdminApplicationList applicationsPromise={applicationsPromise} />
      </div>
    </Box>
  );
}
