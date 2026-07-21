import { TabBar } from "@/components/TabBar";
import { MatchedBeaconWatcher } from "@/components/MatchedBeaconWatcher";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <TabBar currentUserId={user.id} />
      <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
      <MatchedBeaconWatcher currentUserId={user.id} />
    </div>
  );
}
