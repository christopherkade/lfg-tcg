"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestJoin } from "@/app/actions/joins";
import { BeaconDetailDialog } from "@/components/BeaconDetailDialog";
import type { BeaconWithRelations, Profile } from "@/types/database";

interface MatchFeedProps {
  profile: Profile;
  currentUserId: string;
}

export function MatchFeed({ profile, currentUserId }: MatchFeedProps) {
  const [beacons, setBeacons] = useState<BeaconWithRelations[] | null>(null);
  const [pendingBeaconId, setPendingBeaconId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);

  const fetchActiveBeacons = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("beacons")
      .select("*, profiles(*), beacon_joins(*, profiles(*))")
      .eq("game_key", profile.preferred_game)
      .eq("playstyle_key", profile.preferred_playstyle)
      .eq("status", "ACTIVE")
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", currentUserId);

    if (
      profile.preferred_game === "MTG" &&
      profile.preferred_brackets?.length
    ) {
      query = query.overlaps("power_tiers", profile.preferred_brackets);
    }

    const { data } = await query;
    setBeacons((data as BeaconWithRelations[]) ?? []);
  }, [
    profile.preferred_game,
    profile.preferred_playstyle,
    profile.preferred_brackets,
    currentUserId,
  ]);

  // Routed through a ref (rather than listed as an effect dependency)
  // because `fetchActiveBeacons` gets a new identity whenever `profile`
  // is refetched server-side (e.g. `preferred_brackets` is a fresh array
  // reference every time, even with identical contents) — which happens
  // on essentially every beacon/join mutation elsewhere in the app that
  // calls `revalidatePath("/beacons")`. Depending on it directly would
  // tear down and resubscribe this channel constantly, opening gaps where
  // realtime events get silently missed. The ref keeps the subscription
  // itself stable for the component's full lifetime while still always
  // calling the latest (correctly-filtered) fetch logic.
  const fetchActiveBeaconsRef = useRef(fetchActiveBeacons);
  useEffect(() => {
    fetchActiveBeaconsRef.current = fetchActiveBeacons;
  }, [fetchActiveBeacons]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("match-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => fetchActiveBeaconsRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacon_joins" },
        () => fetchActiveBeaconsRef.current(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchActiveBeaconsRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleRequestJoin(beaconId: string) {
    setPendingBeaconId(beaconId);
    setError(null);
    const result = await requestJoin(beaconId);
    if (result.error) {
      setError(result.error);
    }
    setPendingBeaconId(null);
  }

  if (beacons === null) {
    return <p className="text-sm text-zinc-500">Loading match feed...</p>;
  }

  if (beacons.length === 0) {
    return (
      <div className="flex flex-1 w-full items-center justify-center">
        <p className="text-sm text-zinc-500">
          No active beacons match your filters yet.
        </p>
      </div>
    );
  }

  const selectedBeacon =
    beacons.find((beacon) => beacon.id === selectedBeaconId) ?? null;

  return (
    <>
      <div className="flex w-full max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-50">Match Feed</h2>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {beacons.map((beacon) => {
          const acceptedMembers = beacon.beacon_joins.filter(
            (j) => j.status === "ACCEPTED",
          );
          const ownJoin = beacon.beacon_joins.find(
            (j) => j.user_id === currentUserId,
          );

          return (
            <div
              key={beacon.id}
              onClick={() => setSelectedBeaconId(beacon.id)}
              className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-50">
                  {beacon.profiles.username}
                </span>
                <span className="text-xs text-zinc-500">
                  {acceptedMembers.length + 1}/{beacon.max_players}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span>{beacon.format_key}</span>
                <span>&middot;</span>
                <span>{beacon.type}</span>
                {beacon.power_tiers && beacon.power_tiers.length > 0 && (
                  <>
                    <span>&middot;</span>
                    <span>Bracket {beacon.power_tiers.join(", ")}</span>
                  </>
                )}
                {beacon.location_name && (
                  <>
                    <span>&middot;</span>
                    <span>{beacon.location_name}</span>
                  </>
                )}
              </div>

              {acceptedMembers.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2">
                  {acceptedMembers.map((join) => (
                    <div
                      key={join.id}
                      className="flex justify-between text-xs text-zinc-400"
                    >
                      <span>{join.profiles.username}</span>
                      <span>{join.profiles.discord_handle}</span>
                    </div>
                  ))}
                </div>
              )}

              {ownJoin && (
                <span className="self-start rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
                  {ownJoin.status === "PENDING" && "Request Pending"}
                  {ownJoin.status === "ACCEPTED" && "Joined"}
                  {ownJoin.status === "REJECTED" && "Request Rejected"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <BeaconDetailDialog
        beacon={selectedBeacon}
        currentUserId={currentUserId}
        onClose={() => setSelectedBeaconId(null)}
        onRequestJoin={handleRequestJoin}
        pending={
          selectedBeacon != null && pendingBeaconId === selectedBeacon.id
        }
        error={error}
      />
    </>
  );
}
