import { TabBar } from "@/components/TabBar";
import { MatchedPodWatcher } from "@/components/MatchedPodWatcher";
import { PodRealtimeProvider } from "@/components/PodRealtimeProvider";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <PodRealtimeProvider>
      <div className="flex flex-1 flex-col">
        <TabBar currentUserId={user.id} />
        <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
        <MatchedPodWatcher currentUserId={user.id} />
      </div>
    </PodRealtimeProvider>
  );
}
