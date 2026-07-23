"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const fetchOwnBeacon = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("beacons")
      .select("*, profiles(*), beacon_joins(*, profiles(*))")
      .eq("user_id", currentUserId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    setBeacon((data as BeaconWithRelations) ?? null);
  }, [currentUserId]);

  // Routed through a ref rather than listed as an effect dependency — see
  // repo memory on realtime channel churn / ref-indirection pattern.
  const fetchOwnBeaconRef = useRef(fetchOwnBeacon);
  useEffect(() => {
    fetchOwnBeaconRef.current = fetchOwnBeacon;
  }, [fetchOwnBeacon]);

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event self-heals without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchOwnBeaconRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`own-beacon-panel-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => fetchOwnBeaconRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacon_joins" },
        () => fetchOwnBeaconRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (!beacon) {
    return null;
  }

  return <MyBeaconPanel beacon={beacon} onChanged={fetchOwnBeacon} />;
}
