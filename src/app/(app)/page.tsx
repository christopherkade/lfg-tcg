import { requireProfile } from "@/lib/session";
import { LfgButton } from "@/components/LfgButton";
import type { Beacon } from "@/types/database";

export default async function LfgPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: ownBeacon } = await supabase
    .from("beacons")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
      <LfgButton profile={profile} ownBeacon={ownBeacon as Beacon | null} />
    </div>
  );
}
