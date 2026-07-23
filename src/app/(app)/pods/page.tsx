import { requireProfile } from "@/lib/session";
import { OwnPodPanel } from "@/components/OwnPodPanel";
import { MatchFeed } from "@/components/MatchFeed";
import type { PodWithRelations } from "@/types/database";

export default async function PodsPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: ownPod } = await supabase
    .from("pods")
    .select("*, profiles(*), pod_joins(*, profiles(*))")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  const activePod = ownPod as PodWithRelations | null;

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-950 px-6 py-10">
      <OwnPodPanel currentUserId={user.id} initialPod={activePod} />
      <MatchFeed profile={profile} currentUserId={user.id} />
    </div>
  );
}
