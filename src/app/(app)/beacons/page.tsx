import { requireProfile } from "@/lib/session";
import { OwnBeaconPanel } from "@/components/OwnBeaconPanel";
import { MatchFeed } from "@/components/MatchFeed";
import type { BeaconWithRelations } from "@/types/database";

export default async function BeaconsPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: ownBeacon } = await supabase
    .from("beacons")
    .select("*, profiles(*), beacon_joins(*, profiles(*))")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  const activeBeacon = ownBeacon as BeaconWithRelations | null;

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-950 px-6 py-10">
      <OwnBeaconPanel currentUserId={user.id} initialBeacon={activeBeacon} />
      <MatchFeed profile={profile} currentUserId={user.id} />
    </div>
  );
}
