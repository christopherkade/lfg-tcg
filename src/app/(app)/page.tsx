import { requireProfile } from "@/lib/session";
import { LfgButton } from "@/components/LfgButton";
import type { Pod } from "@/types/database";

export default async function LfgPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: ownPod } = await supabase
    .from("pods")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  // A PENDING request on (or ACCEPTED into) someone else's still-ACTIVE
  // pod blocks starting a new search — see CantStartSearchDialog /
  // createPod's mirrored server-side check.
  const { data: activeJoin } = await supabase
    .from("pod_joins")
    .select("id, pods!inner(status)")
    .eq("user_id", user.id)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("pods.status", "ACTIVE")
    .maybeSingle();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
      <LfgButton
        profile={profile}
        ownPod={ownPod as Pod | null}
        hasActiveJoin={activeJoin != null}
      />
    </div>
  );
}
