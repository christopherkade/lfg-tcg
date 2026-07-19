import { TabBar } from "@/components/TabBar";
import { JoinRequestNotifier } from "@/components/JoinRequestNotifier";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <TabBar />
      <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
      <JoinRequestNotifier currentUserId={user.id} />
    </div>
  );
}
