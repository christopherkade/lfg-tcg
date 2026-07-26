import { isSameDay } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PodFiltersValue } from "@/components/PodFilters";
import type { PodWithRelations, Profile } from "@/types/database";

// Shape of each row returned by the "joined pods" query below — a
// pod_joins row with its parent pod (and that pod's own
// relations) embedded via the `pods!inner(...)` foreign-table select.
interface JoinedPodRow {
  pods: PodWithRelations;
}

/**
 * The feed's initial filter state — unlike the "Clear all" neutral state
 * (NEUTRAL_POD_FILTERS), this only seeds the Game filter from the
 * viewer's own profile so first load still browses meaningfully (their own
 * game) instead of showing every game at once. Every other field —
 * including Power Bracket — starts unset/"no restriction", same as the
 * neutral state. Power Bracket specifically must NOT default to
 * `profile.preferred_brackets`: that column is last-used LFG *search*
 * settings, not a standing browse preference, so silently applying it here
 * would hide pods outside whatever bracket the viewer happened to
 * search for last, with no visible indication why (the Power Bracket chip
 * is the only thing that would show it, and nothing prompts the viewer to
 * check it since they never touched it this session).
 */
export function getInitialFilters(profile: Profile): PodFiltersValue {
  return {
    gameKey: profile.preferred_game,
    matchType: "ALL",
    formatKey: "ALL",
    date: null,
    powerBrackets: [],
  };
}

/**
 * Runs the Match Feed's "joined pods" + "filtered browse pods" queries and
 * merges them, exactly matching MatchFeed's own client-side refetch logic.
 * Shared so PodsView can seed the feed's initial data server-side (avoiding
 * a client round-trip + loading flash on every /pods navigation) using the
 * same query logic MatchFeed uses for filter changes and realtime refetches.
 * Takes a plain `SupabaseClient` so it works with both the server and
 * browser client instances.
 */
export async function fetchActivePodsData(
  supabase: SupabaseClient,
  currentUserId: string,
  profile: Profile,
  activeFilters: PodFiltersValue,
): Promise<PodWithRelations[]> {
  // Pods the viewer has a live (PENDING/ACCEPTED) join request on must
  // always be shown, regardless of every filter/scoping rule below.
  const joinedQuery = supabase
    .from("pod_joins")
    .select("pods!inner(*, profiles(*), pod_joins(*, profiles(*)))")
    .eq("user_id", currentUserId)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("pods.status", "ACTIVE")
    .gt("pods.expires_at", new Date().toISOString());

  // City scoping: IRL pods only make sense to show if they're near the
  // viewer. A viewer with no city on file can't be matched to any IRL pod,
  // so skip the filtered query entirely rather than show an unscoped list.
  const skipFilteredQuery =
    activeFilters.matchType === "IRL" && !profile.city;

  let filteredQuery = null;
  if (!skipFilteredQuery) {
    let query = supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
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

    filteredQuery = query;
  }

  // Independent queries — run concurrently instead of sequentially.
  const [
    { data: joinedData, error: joinedError },
    filteredData,
  ] = await Promise.all([
    joinedQuery,
    filteredQuery ? filteredQuery : Promise.resolve({ data: [], error: null }),
  ]);

  console.log(
    "[DEBUG fetchActivePodsData] " +
      JSON.stringify({
        currentUserId,
        activeFilters,
        profileCity: profile.city,
        profilePlaystyle: profile.preferred_playstyle,
        joinedError: joinedError ? String(joinedError.message) : null,
        joinedCount: (joinedData as JoinedPodRow[] | null)?.length ?? -1,
        filteredError: filteredData.error
          ? String((filteredData.error as { message?: string }).message)
          : null,
        filteredCount:
          (filteredData.data as PodWithRelations[] | null)?.length ?? -1,
      }),
  );

  const joinedPods = ((joinedData as JoinedPodRow[] | null) ?? []).map(
    (row) => row.pods,
  );

  let filteredRows = (filteredData.data as PodWithRelations[] | null) ?? [];

  // Date filtering isn't a plain column match (ONLINE pods have no
  // scheduled_at, so cards fall back to created_at — see formatPodWhen),
  // so it's applied client-side against the same effective date shown on
  // each card rather than via the query.
  if (activeFilters.date) {
    const targetDate = activeFilters.date;
    filteredRows = filteredRows.filter((pod) =>
      isSameDay(new Date(pod.scheduled_at ?? pod.created_at), targetDate),
    );
  }

  // Merge, with joined pods first (de-duplicated against the filtered
  // results, since a joined pod may also legitimately satisfy the current
  // filters on its own).
  const joinedIds = new Set(joinedPods.map((pod) => pod.id));
  return [
    ...joinedPods,
    ...filteredRows.filter((pod) => !joinedIds.has(pod.id)),
  ];
}
