import { redirect } from "next/navigation";
import { TabBar } from "@/components/TabBar";
import { MatchedPodWatcher } from "@/components/MatchedPodWatcher";
import { PodRealtimeProvider } from "@/components/PodRealtimeProvider";
import { NotificationCenterProvider } from "@/components/NotificationCenterProvider";
import { ProfileLockProvider } from "@/lib/ProfileLockContext";
import { UserProfilePanelProvider } from "@/lib/UserProfilePanelContext";
import { getTrustedUserId, getProfile, getOrganizer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts has already network-verified auth for this request and
  // redirects unauthenticated requests before they reach here — trust its
  // result instead of paying for a second auth.getUser() round-trip. Pages
  // below still call requireUser()/requireProfile() themselves wherever
  // they need the full user object or their own redirect guarantee.
  const userId = await getTrustedUserId();
  if (!userId) {
    redirect("/login");
  }

  // Needed here (not just per-page) so the tab bar knows to lock navigation
  // for brand-new accounts — see ProfileLockContext.
  const supabase = await createClient();
  const [profile, organizer] = await Promise.all([
    getProfile(supabase, userId),
    getOrganizer(supabase, userId),
  ]);

  return (
    <PodRealtimeProvider>
      <NotificationCenterProvider currentUserId={userId}>
        <ProfileLockProvider usernameMissing={!profile}>
          <UserProfilePanelProvider>
            <div className="flex flex-1 flex-col">
              <TabBar isOrganizer={organizer != null} isAdmin={profile?.is_admin ?? false} />
              <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
              <MatchedPodWatcher currentUserId={userId} />
            </div>
          </UserProfilePanelProvider>
        </ProfileLockProvider>
      </NotificationCenterProvider>
    </PodRealtimeProvider>
  );
}
