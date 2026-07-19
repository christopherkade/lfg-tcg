"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MyBeaconPanel } from "@/components/MyBeaconPanel";
import type { BeaconWithRelations } from "@/types/database";

interface OwnBeaconPanelProps {
  currentUserId: string;
  initialBeacon: BeaconWithRelations | null;
}

/**
 * Client wrapper around MyBeaconPanel that keeps the host's own active
 * beacon (and its join requests / accepted members) in sync with realtime
 * changes, so the panel appears/disappears and its request list updates
 * live instead of only reflecting whatever was fetched on the last page
 * load. Mirrors MatchFeed's "no server-side filter, just refetch on any
 * change" approach.
 */
export function OwnBeaconPanel({
  currentUserId,
  initialBeacon,
}: OwnBeaconPanelProps) {
  const [beacon, setBeacon] = useState<BeaconWithRelations | null>(
    initialBeacon,
  );

  useEffect(() => {
    const supabase = createClient();

    async function fetchOwnBeacon() {
      const { data } = await supabase
        .from("beacons")
        .select("*, profiles(*), beacon_joins(*, profiles(*))")
        .eq("user_id", currentUserId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      setBeacon((data as BeaconWithRelations) ?? null);
    }

    const channel = supabase
      .channel(`own-beacon-panel-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => fetchOwnBeacon(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacon_joins" },
        () => fetchOwnBeacon(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (!beacon) {
    return null;
  }

  return <MyBeaconPanel beacon={beacon} />;
}
