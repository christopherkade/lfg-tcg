"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { Alert } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { requestJoin, leaveBeacon } from "@/app/actions/joins";
import { BeaconDetailDialog } from "@/components/BeaconDetailDialog";
import {
  BeaconFilters,
  type BeaconFiltersValue,
} from "@/components/BeaconFilters";
import { CITY_MAP } from "@/constants/citiesConfig";
import type { BeaconWithRelations, Profile } from "@/types/database";

interface MatchFeedProps {
  profile: Profile;
  currentUserId: string;
}

// Shape of each row returned by the "joined beacons" query below — a
// beacon_joins row with its parent beacon (and that beacon's own
// relations) embedded via the `beacons!inner(...)` foreign-table select.
interface JoinedBeaconRow {
  beacons: BeaconWithRelations;
}

/**
 * The feed's initial filter state — unlike the "Clear all" neutral state
 * (NEUTRAL_BEACON_FILTERS), this only seeds the Game filter from the
 * viewer's own profile so first load still browses meaningfully (their own
 * game) instead of showing every game at once. Every other field —
 * including Power Bracket — starts unset/"no restriction", same as the
 * neutral state. Power Bracket specifically must NOT default to
 * `profile.preferred_brackets`: that column is last-used LFG *search*
 * settings, not a standing browse preference, so silently applying it here
 * would hide beacons outside whatever bracket the viewer happened to
 * search for last, with no visible indication why (the Power Bracket chip
 * is the only thing that would show it, and nothing prompts the viewer to
 * check it since they never touched it this session).
 */
function getInitialFilters(profile: Profile): BeaconFiltersValue {
  return {
    gameKey: profile.preferred_game,
    matchType: "ALL",
    formatKey: "ALL",
    date: null,
    powerBrackets: [],
  };
}

export function MatchFeed({ profile, currentUserId }: MatchFeedProps) {
  const [beacons, setBeacons] = useState<BeaconWithRelations[] | null>(null);
  const [pendingBeaconId, setPendingBeaconId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BeaconFiltersValue>(() =>
    getInitialFilters(profile),
  );

  const fetchActiveBeacons = useCallback(
    async (activeFilters: BeaconFiltersValue) => {
      const supabase = createClient();

      // Beacons the viewer has a live (PENDING/ACCEPTED) join request on
      // must always be shown, regardless of every filter/scoping rule
      // below — otherwise adjusting a browsing filter (or even just the
      // always-on playstyle/city scoping) could make a beacon the viewer
      // is actively part of silently vanish from their own feed while
      // they still have a pending request in, or are coordinating as an
      // accepted member. This is queried unconditionally, independent of
      // the filtered query further down.
      const { data: joinedData } = await supabase
        .from("beacon_joins")
        .select("beacons!inner(*, profiles(*), beacon_joins(*, profiles(*)))")
        .eq("user_id", currentUserId)
        .in("status", ["PENDING", "ACCEPTED"])
        .eq("beacons.status", "ACTIVE")
        .gt("beacons.expires_at", new Date().toISOString());

      const joinedBeacons = (
        (joinedData as JoinedBeaconRow[] | null) ?? []
      ).map((row) => row.beacons);

      // City scoping: IRL beacons only make sense to show if they're near
      // the viewer, so they're always restricted to the viewer's own
      // `profiles.city` regardless of the Match Type filter above — Online
      // beacons are exempt (no IRL travel involved) and always show. A
      // viewer with no city on file simply can't be matched to any IRL
      // beacon (there's nothing to compare against), so skip the filtered
      // query entirely rather than show an unscoped/incorrect IRL list —
      // any joined beacons above still show regardless.
      let filteredRows: BeaconWithRelations[] = [];
      if (!(activeFilters.matchType === "IRL" && !profile.city)) {
        let query = supabase
          .from("beacons")
          .select("*, profiles(*), beacon_joins(*, profiles(*))")
          .eq("playstyle_key", profile.preferred_playstyle)
          .eq("status", "ACTIVE")
          .gt("expires_at", new Date().toISOString())
          .neq("user_id", currentUserId);

        if (activeFilters.matchType === "ONLINE") {
          query = query.eq("type", "ONLINE");
        } else if (activeFilters.matchType === "IRL") {
          // profile.city is guaranteed set here (see the branch guard above).
          query = query.eq("type", "IRL").eq("city", profile.city as string);
        } else if (profile.city) {
          query = query.or(
            `type.eq.ONLINE,and(type.eq.IRL,city.eq.${profile.city})`,
          );
        } else {
          query = query.eq("type", "ONLINE");
        }

        if (activeFilters.gameKey !== "ALL") {
          query = query.eq("game_key", activeFilters.gameKey);
        }
        if (activeFilters.formatKey !== "ALL") {
          query = query.eq("format_key", activeFilters.formatKey);
        }
        if (activeFilters.powerBrackets.length > 0) {
          query = query.overlaps("power_tiers", activeFilters.powerBrackets);
        }

        const { data } = await query;
        filteredRows = (data as BeaconWithRelations[]) ?? [];

        // Date filtering isn't a plain column match (ONLINE beacons have no
        // scheduled_at, so cards fall back to created_at — see
        // formatScheduledAt below), so it's applied client-side against the
        // same effective date shown on each card rather than via the query.
        if (activeFilters.date) {
          const targetDate = activeFilters.date;
          filteredRows = filteredRows.filter((beacon) =>
            isSameDay(
              new Date(beacon.scheduled_at ?? beacon.created_at),
              targetDate,
            ),
          );
        }
      }

      // Merge, with joined beacons first (and de-duplicated against the
      // filtered results, since a joined beacon may also legitimately
      // satisfy the current filters on its own).
      const joinedIds = new Set(joinedBeacons.map((beacon) => beacon.id));
      const rows = [
        ...joinedBeacons,
        ...filteredRows.filter((beacon) => !joinedIds.has(beacon.id)),
      ];

      setBeacons(rows);
    },
    [profile.preferred_playstyle, profile.city, currentUserId],
  );

  // Filters live in a ref (mirrored from state below) so the realtime/focus
  // callbacks further down — which only ever call the *latest* fetch via
  // fetchActiveBeaconsRef — always refetch against the current filters
  // rather than whatever was in scope when the subscription was set up.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  function handleFiltersChange(next: BeaconFiltersValue) {
    setFilters(next);
    fetchActiveBeacons(next);
  }

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

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event (e.g. "Request to Join" not flipping to "Pending" live) self-heals
  // without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchActiveBeaconsRef.current(filtersRef.current);
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
      .channel("match-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => fetchActiveBeaconsRef.current(filtersRef.current),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacon_joins" },
        () => fetchActiveBeaconsRef.current(filtersRef.current),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchActiveBeaconsRef.current(filtersRef.current);
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
    } else {
      // Don't rely solely on the realtime subscription to reflect this in
      // the UI — postgres_changes delivery is known-unreliable in this
      // project (see repo memory), and the resulting gap left the dialog
      // stuck showing "Request to Join" even though the row was already
      // written, so a second click would then fail with a unique
      // constraint error. Refetch immediately on success instead.
      await fetchActiveBeacons(filtersRef.current);
    }
    setPendingBeaconId(null);
  }

  async function handleLeave(beaconId: string) {
    setPendingBeaconId(beaconId);
    setError(null);
    const result = await leaveBeacon(beaconId);
    if (result.error) {
      setError(result.error);
    } else {
      await fetchActiveBeacons(filtersRef.current);
    }
    setPendingBeaconId(null);
  }

  const selectedBeacon =
    beacons?.find((beacon) => beacon.id === selectedBeaconId) ?? null;

  function formatScheduledAt(beacon: BeaconWithRelations) {
    const date = beacon.scheduled_at
      ? new Date(beacon.scheduled_at)
      : new Date(beacon.created_at);
    return isToday(date)
      ? `Today, ${format(date, "p")}`
      : format(date, "MMM d, p");
  }

  return (
    <>
      <div className="flex w-full max-w-md flex-col gap-3">
        <BeaconFilters value={filters} onChange={handleFiltersChange} />
        <h2 className="text-lg font-semibold text-zinc-50">Match Feed</h2>
        {!profile.city && (
          <p className="text-xs text-zinc-500">
            Set your city on your Profile to see in-person beacons near you —
            Online beacons always show regardless of city.
          </p>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {beacons === null ? (
          <p className="text-sm text-zinc-500">Loading match feed...</p>
        ) : beacons.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No active beacons match your filters yet.
          </p>
        ) : (
          beacons.map((beacon) => {
            const acceptedMembers = beacon.beacon_joins.filter(
              (j) => j.status === "ACCEPTED",
            );
            const ownJoin = beacon.beacon_joins.find(
              (j) => j.user_id === currentUserId,
            );
            const isJoined = ownJoin?.status === "ACCEPTED";

            return (
              <div
                key={beacon.id}
                onClick={() => setSelectedBeaconId(beacon.id)}
                className={`flex cursor-pointer flex-col gap-2 rounded-2xl border bg-zinc-900 p-4 transition-colors ${
                  isJoined
                    ? "border-green-500/50 hover:border-green-500/70"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-50">
                      {beacon.profiles.username}
                    </span>
                    {isJoined && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-400">
                        JOINED
                      </span>
                    )}
                  </div>
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
                      <span>
                        {beacon.location_name}
                        {beacon.city && CITY_MAP[beacon.city]
                          ? ` (${CITY_MAP[beacon.city].label})`
                          : ""}
                      </span>
                    </>
                  )}
                  <span>&middot;</span>
                  <span>{formatScheduledAt(beacon)}</span>
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

                {ownJoin &&
                  (ownJoin.status === "REJECTED" ? (
                    <span className="self-start rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
                      Request Rejected
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingBeaconId === beacon.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleLeave(beacon.id);
                      }}
                      className="self-start rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {pendingBeaconId === beacon.id
                        ? "..."
                        : ownJoin.status === "PENDING"
                          ? "Cancel Request"
                          : "Leave"}
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>

      <BeaconDetailDialog
        beacon={selectedBeacon}
        currentUserId={currentUserId}
        onClose={() => setSelectedBeaconId(null)}
        onRequestJoin={handleRequestJoin}
        onLeave={handleLeave}
        pending={
          selectedBeacon != null && pendingBeaconId === selectedBeacon.id
        }
        error={error}
      />
    </>
  );
}
