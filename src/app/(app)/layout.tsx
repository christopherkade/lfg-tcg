import { redirect } from "next/navigation";
import { TabBar } from "@/components/TabBar";
import { MatchedPodWatcher } from "@/components/MatchedPodWatcher";
import { PodRealtimeProvider } from "@/components/PodRealtimeProvider";
import { getTrustedUserId } from "@/lib/session";

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

  return (
    <PodRealtimeProvider>
      <div className="flex flex-1 flex-col">
        <TabBar currentUserId={userId} />
        <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
        <MatchedPodWatcher currentUserId={userId} />
      </div>
    </PodRealtimeProvider>
  );
}
