"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSameDay } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { SearchX } from "lucide-react";
import { Alert, Avatar } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { requestJoin, leavePod } from "@/app/actions/joins";
import { PodDetailDialog } from "@/components/PodDetailDialog";
import { PodFilters, type PodFiltersValue } from "@/components/PodFilters";
import { CITY_MAP } from "@/constants/citiesConfig";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { PodWithRelations, Profile } from "@/types/database";

interface MatchFeedProps {
  profile: Profile;
  currentUserId: string;
  /** Pod to auto-open in PodDetailDialog, from visiting /pods/<id> directly. */
  initialSharedPod?: PodWithRelations | null;
}

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
function getInitialFilters(profile: Profile): PodFiltersValue {
  return {
    gameKey: profile.preferred_game,
    matchType: "ALL",
    formatKey: "ALL",
    date: null,
    powerBrackets: [],
  };
}

export function MatchFeed({
  profile,
  currentUserId,
  initialSharedPod = null,
}: MatchFeedProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [pods, setPods] = useState<PodWithRelations[] | null>(null);
  const [pendingPodId, setPendingPodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(
    initialSharedPod?.id ?? null,
  );
  const [filters, setFilters] = useState<PodFiltersValue>(() =>
    getInitialFilters(profile),
  );

  // A pod opened via a shared /pods/<id> link isn't necessarily part of the
  // viewer's own feed (it may not match their filters, or may even be their
  // own pod, which the feed query below always excludes) — so it's tracked
  // separately from `pods` and only merged in for the dialog lookup below,
  // rather than being forced into the visible feed list.
  const [pinnedPod, setPinnedPod] = useState<PodWithRelations | null>(
    initialSharedPod,
  );
  const pinnedPodIdRef = useRef(initialSharedPod?.id ?? null);

  const fetchActivePods = useCallback(
    async (activeFilters: PodFiltersValue) => {
      const supabase = createClient();

      // Pods the viewer has a live (PENDING/ACCEPTED) join request on
      // must always be shown, regardless of every filter/scoping rule
      // below — otherwise adjusting a browsing filter (or even just the
      // always-on playstyle/city scoping) could make a pod the viewer
      // is actively part of silently vanish from their own feed while
      // they still have a pending request in, or are coordinating as an
      // accepted member. This is queried unconditionally, independent of
      // the filtered query further down.
      const { data: joinedData } = await supabase
        .from("pod_joins")
        .select("pods!inner(*, profiles(*), pod_joins(*, profiles(*)))")
        .eq("user_id", currentUserId)
        .in("status", ["PENDING", "ACCEPTED"])
        .eq("pods.status", "ACTIVE")
        .gt("pods.expires_at", new Date().toISOString());

      const joinedPods = ((joinedData as JoinedPodRow[] | null) ?? []).map(
        (row) => row.pods,
      );

      // City scoping: IRL pods only make sense to show if they're near
      // the viewer, so they're always restricted to the viewer's own
      // `profiles.city` regardless of the Match Type filter above — Online
      // pods are exempt (no IRL travel involved) and always show. A
      // viewer with no city on file simply can't be matched to any IRL
      // pod (there's nothing to compare against), so skip the filtered
      // query entirely rather than show an unscoped/incorrect IRL list —
      // any joined pods above still show regardless.
      let filteredRows: PodWithRelations[] = [];
      if (!(activeFilters.matchType === "IRL" && !profile.city)) {
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

        const { data } = await query;
        filteredRows = (data as PodWithRelations[]) ?? [];

        // Date filtering isn't a plain column match (ONLINE pods have no
        // scheduled_at, so cards fall back to created_at — see
        // formatPodWhen), so it's applied client-side against the
        // same effective date shown on each card rather than via the query.
        if (activeFilters.date) {
          const targetDate = activeFilters.date;
          filteredRows = filteredRows.filter((pod) =>
            isSameDay(new Date(pod.scheduled_at ?? pod.created_at), targetDate),
          );
        }
      }

      // Merge, with joined pods first (and de-duplicated against the
      // filtered results, since a joined pod may also legitimately
      // satisfy the current filters on its own).
      const joinedIds = new Set(joinedPods.map((pod) => pod.id));
      const rows = [
        ...joinedPods,
        ...filteredRows.filter((pod) => !joinedIds.has(pod.id)),
      ];

      setPods(rows);

      // Keep the shared/pinned pod (opened via /pods/<id>) fresh across every
      // refetch trigger below (realtime events, focus resync, post-join/leave
      // refetch) so its join status in the dialog never goes stale — it's
      // intentionally excluded from `rows` above since it may not match the
      // viewer's filters or may be their own pod.
      if (pinnedPodIdRef.current) {
        const { data: pinnedData } = await supabase
          .from("pods")
          .select("*, profiles(*), pod_joins(*, profiles(*))")
          .eq("id", pinnedPodIdRef.current)
          .maybeSingle();
        setPinnedPod((pinnedData as PodWithRelations) ?? null);
      }
    },
    [profile.preferred_playstyle, profile.city, currentUserId],
  );

  // Filters live in a ref (mirrored from state below) so the realtime/focus
  // callbacks further down — which only ever call the *latest* fetch via
  // fetchActivePodsRef — always refetch against the current filters
  // rather than whatever was in scope when the subscription was set up.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  function handleFiltersChange(next: PodFiltersValue) {
    setFilters(next);
    fetchActivePods(next);
  }

  // Routed through a ref (rather than listed as an effect dependency)
  // because `fetchActivePods` gets a new identity whenever `profile`
  // is refetched server-side (e.g. `preferred_brackets` is a fresh array
  // reference every time, even with identical contents) — which happens
  // on essentially every pod/join mutation elsewhere in the app that
  // calls `revalidatePath("/pods")`. Depending on it directly would
  // tear down and resubscribe this channel constantly, opening gaps where
  // realtime events get silently missed. The ref keeps the subscription
  // itself stable for the component's full lifetime while still always
  // calling the latest (correctly-filtered) fetch logic.
  const fetchActivePodsRef = useRef(fetchActivePods);
  useEffect(() => {
    fetchActivePodsRef.current = fetchActivePods;
  }, [fetchActivePods]);

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event (e.g. "Request to Join" not flipping to "Pending" live) self-heals
  // without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchActivePodsRef.current(filtersRef.current);
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
        { event: "*", schema: "public", table: "pods" },
        () => fetchActivePodsRef.current(filtersRef.current),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pod_joins" },
        () => fetchActivePodsRef.current(filtersRef.current),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchActivePodsRef.current(filtersRef.current);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleRequestJoin(podId: string) {
    setPendingPodId(podId);
    setError(null);
    const result = await requestJoin(podId);
    if (result.error) {
      setError(result.error);
    } else {
      await fetchActivePodsRef.current(filtersRef.current);
    }
    setPendingPodId(null);
  }

  async function handleLeave(podId: string) {
    setPendingPodId(podId);
    setError(null);
    const result = await leavePod(podId);
    if (result.error) {
      setError(result.error);
    } else {
      await fetchActivePodsRef.current(filtersRef.current);
    }
    setPendingPodId(null);
  }

  const selectedPod =
    pods?.find((pod) => pod.id === selectedPodId) ??
    (pinnedPod?.id === selectedPodId ? pinnedPod : null);

  return (
    <>
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="w-full">
          <PodFilters value={filters} onChange={handleFiltersChange} />
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          <h2 className="text-lg font-semibold text-white">{t("matchFeed.title")}</h2>
          {!profile.city && (
            <p className="text-xs text-white">
              {t("matchFeed.noCityHint")}
            </p>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {pods === null ? (
            <p className="text-sm text-white">{t("matchFeed.loading")}</p>
          ) : pods.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <SearchX className="h-8 w-8 text-white" />
              <p className="text-sm font-medium text-white">
                {t("matchFeed.empty.title")}
              </p>
              <p className="text-xs text-white">
                {t("matchFeed.empty.subtitle")}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pods.map((pod) => {
                const acceptedMembers = pod.pod_joins.filter(
                  (j) => j.status === "ACCEPTED",
                );
                const ownJoin = pod.pod_joins.find(
                  (j) => j.user_id === currentUserId,
                );
                const isJoined = ownJoin?.status === "ACCEPTED";

                return (
                  <motion.div
                    key={pod.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={() => setSelectedPodId(pod.id)}
                    className={`flex cursor-pointer flex-col gap-2 rounded-2xl border bg-zinc-900 p-4 transition-colors ${
                      isJoined
                        ? "border-green-500/50 hover:border-green-500/70"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={pod.profiles.avatar_url ?? undefined}
                          sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                        >
                          {pod.profiles.username[0]?.toUpperCase()}
                        </Avatar>
                        <span className="font-medium text-white">
                          {pod.profiles.username}
                        </span>
                        {isJoined && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-400">
                            {t("matchFeed.joined")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white">
                        {acceptedMembers.length + 1}/{pod.max_players}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-white">
                      <span>{t(`format.${pod.format_key}` as TranslationKey)}</span>
                      <span>&middot;</span>
                      <span>
                        {pod.type === "IRL"
                          ? t("podFilters.matchTypeIrl")
                          : t("podFilters.matchTypeOnline")}
                      </span>
                      {pod.power_tiers && pod.power_tiers.length > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>
                            {t("matchFeed.bracket", {
                              brackets: pod.power_tiers.join(", "),
                            })}
                          </span>
                        </>
                      )}
                      {pod.location_name && (
                        <>
                          <span>&middot;</span>
                          <span>
                            {pod.location_name}
                            {pod.city && CITY_MAP[pod.city]
                              ? ` (${CITY_MAP[pod.city].label})`
                              : ""}
                          </span>
                        </>
                      )}
                      <span>&middot;</span>
                      <span>{formatPodWhen(pod, locale, t)}</span>
                    </div>

                    {acceptedMembers.length > 0 && (
                      <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2">
                        {acceptedMembers.map((join) => (
                          <div
                            key={join.id}
                            className="flex items-center justify-between text-xs text-white"
                          >
                            <div className="flex items-center gap-1.5">
                              <Avatar
                                src={join.profiles.avatar_url ?? undefined}
                                sx={{ width: 18, height: 18, fontSize: "0.625rem" }}
                              >
                                {join.profiles.username[0]?.toUpperCase()}
                              </Avatar>
                              <span>{join.profiles.username}</span>
                            </div>
                            <span>{join.profiles.discord_handle}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {ownJoin &&
                      (ownJoin.status === "REJECTED" ? (
                        <span className="self-start rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-white">
                          {t("matchFeed.requestRejected")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingPodId === pod.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleLeave(pod.id);
                          }}
                          className="self-start rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {pendingPodId === pod.id
                            ? t("matchFeed.leaving")
                            : ownJoin.status === "PENDING"
                              ? t("matchFeed.cancelRequest")
                              : t("matchFeed.leave")}
                        </button>
                      ))}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <PodDetailDialog
        pod={selectedPod}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedPodId(null);
          // Only strip the URL back to /pods once the viewer closes out of
          // a pod they opened via a shared /pods/<id> link — doing this
          // eagerly on mount instead (the previous approach) navigated away
          // from the dynamic route immediately, remounting this component
          // without `initialSharedPod` and closing the dialog right after
          // it flashed open.
          if (pinnedPodIdRef.current) {
            router.replace("/pods", { scroll: false });
          }
        }}
        onRequestJoin={handleRequestJoin}
        onLeave={handleLeave}
        pending={selectedPod != null && pendingPodId === selectedPod.id}
        error={error}
      />
    </>
  );
}
